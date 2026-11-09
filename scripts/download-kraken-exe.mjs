#!/usr/bin/env node
/**
 * Baixa o binário grande do app (Kraken Free Buff.exe) para `vendor/`,
 * fora do controle de versão.
 *
 * O arquivo tem ~260 MB, então nunca entra no Git: é publicado como asset de
 * release (ou em qualquer URL direta) e buscado por aqui, com checagem de
 * SHA-256 para garantir que o download chegou inteiro.
 *
 * Uso:
 *   npm run kraken:download            # baixa se ainda não existir
 *   npm run kraken:download -- --force # rebaixa
 *
 * Config (variável de ambiente ou .env/.env.local na raiz):
 *   KRAKEN_EXE_URL      URL direta do arquivo (obrigatória)
 *   KRAKEN_EXE_SHA256   hash esperado (opcional, mas recomendado)
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'vendor', 'Kraken Free Buff.exe');
const force = process.argv.includes('--force');

function loadEnvFile(name) {
  const path = join(ROOT, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '').trim();
  }
}

async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * No Windows, renomear por cima de um arquivo aberto (antivírus, player, IDE)
 * falha com EPERM; apagar antes resolve.
 */
function moveIntoPlace(from, to) {
  try {
    renameSync(from, to);
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES' && error.code !== 'EEXIST') throw error;
    rmSync(to, { force: true });
    renameSync(from, to);
  }
}

function get(url, redirectsLeft = 10) {
  return new Promise((resolvePromise, reject) => {
    const client = url.startsWith('http://') ? httpRequest : httpsRequest;
    const req = client(url, { headers: { 'User-Agent': 'prisma-ia-downloader' } }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error('redirecionamentos demais'));
        return resolvePromise(get(new URL(location, url).toString(), redirectsLeft - 1));
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${status} em ${url}`));
      }
      resolvePromise(res);
    });
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error('tempo esgotado (120s)')));
    req.end();
  });
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const url = process.env.KRAKEN_EXE_URL?.trim();
  const expected = (process.env.KRAKEN_EXE_SHA256 ?? '').trim().toLowerCase();

  if (!url) {
    console.error('KRAKEN_EXE_URL não configurada.');
    console.error('Defina a URL do binário (ex.: asset de release) em .env e rode de novo.');
    console.error('  KRAKEN_EXE_URL=https://github.com/OWNER/REPO/releases/download/vX/kraken-free-buff.exe');
    process.exit(1);
  }

  if (existsSync(TARGET) && !force) {
    const atual = await sha256File(TARGET);
    if (!expected || atual === expected) {
      console.log(`Já existe: ${TARGET} (${fmt(statSync(TARGET).size)})`);
      console.log(`sha256 ${atual}`);
      return;
    }
    console.error('O arquivo local não bate com KRAKEN_EXE_SHA256. Use --force para rebaixar.');
    process.exit(1);
  }

  mkdirSync(dirname(TARGET), { recursive: true });
  const tempPath = `${TARGET}.part`;

  console.log(`Baixando ${url}`);
  const res = await get(url);
  const total = Number(res.headers['content-length'] ?? 0);
  const hash = createHash('sha256');
  let baixado = 0;
  let ultimoPct = -1;

  const tap = new Transform({
    transform(chunk, _enc, cb) {
      baixado += chunk.length;
      hash.update(chunk);
      if (total) {
        const pct = Math.floor((baixado / total) * 100);
        if (pct !== ultimoPct) {
          ultimoPct = pct;
          process.stdout.write(`\r${String(pct).padStart(3)}%  ${fmt(baixado)} de ${fmt(total)}`);
        }
      }
      cb(null, chunk);
    },
  });

  try {
    await pipeline(res, tap, createWriteStream(tempPath));
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }

  const digest = hash.digest('hex');
  process.stdout.write('\n');

  if (expected && digest !== expected) {
    rmSync(tempPath, { force: true });
    console.error(`SHA-256 não confere.\n  esperado: ${expected}\n  recebido: ${digest}`);
    process.exit(1);
  }

  moveIntoPlace(tempPath, TARGET);
  console.log(`Pronto: ${TARGET} (${fmt(statSync(TARGET).size)})`);
  console.log(`sha256 ${digest}`);
  if (!expected) console.log('Dica: fixe esse hash em KRAKEN_EXE_SHA256 para validar os próximos downloads.');
}

function fmt(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

main().catch((error) => {
  console.error(`Falha no download: ${error.message}`);
  process.exit(1);
});
