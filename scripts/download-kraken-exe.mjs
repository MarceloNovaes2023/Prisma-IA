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
 *   npm run kraken:download            # baixa se faltar e avisa se estiver velho
 *   npm run kraken:download -- --force # rebaixa
 *   npm run kraken:download -- --check # só confere contra o release, não baixa
 *
 * Quando a URL aponta para um asset de release do GitHub, o script consulta o
 * release e compara o binário local: se o release tiver outra build, ele falha
 * com código 1 dizendo que o arquivo está desatualizado.
 *
 * Config (variável de ambiente ou .env/.env.local na raiz):
 *   KRAKEN_EXE_URL      URL direta do arquivo (obrigatória)
 *   KRAKEN_EXE_SHA256   hash esperado (opcional, mas recomendado)
 *   GITHUB_TOKEN        opcional; só evita o limite de 60 consultas/hora da API
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
const checkOnly = process.argv.includes('--check');

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

function getJson(url) {
  return new Promise((resolvePromise, reject) => {
    const headers = { 'User-Agent': 'prisma-ia-downloader', Accept: 'application/vnd.github+json' };
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = httpsRequest(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try {
          resolvePromise(JSON.parse(data));
        } catch {
          reject(new Error('resposta da API não é JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => req.destroy(new Error('tempo esgotado (15s)')));
    req.end();
  });
}

/** Extrai owner/repo/tag de uma URL de asset de release do GitHub. */
function releaseTarget(url) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/?#]+)\/([^?#]+)/.exec(url ?? '');
  if (!match) return null;
  return { owner: match[1], repo: match[2], tag: decodeURIComponent(match[3]), asset: decodeURIComponent(match[4]) };
}

/**
 * Compara o binário local com o asset publicado no release.
 * `checked: false` significa "não deu para conferir" — URL que não é release do
 * GitHub, release apagado, API fora do ar ou limite de consultas.
 */
async function checkFreshness(localSha, localSize, url) {
  const target = releaseTarget(url);
  if (!target) return { checked: false, reason: 'a URL não é um asset de release do GitHub' };

  const api = `https://api.github.com/repos/${target.owner}/${target.repo}/releases/tags/${encodeURIComponent(target.tag)}`;
  let release;
  try {
    release = await getJson(api);
  } catch (error) {
    return { checked: false, reason: `não consegui consultar o release ${target.tag} (${error.message})` };
  }

  const assets = release.assets ?? [];
  const asset = assets.find((item) => item.name === target.asset) ?? (assets.length === 1 ? assets[0] : null);
  if (!asset) return { checked: false, reason: `o release ${target.tag} não tem o asset ${target.asset}` };

  const digest = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:') ? asset.digest.slice('sha256:'.length) : null;
  if (digest) {
    if (digest === localSha) return { checked: true, stale: false, tag: target.tag, asset };
    return { checked: true, stale: true, tag: target.tag, asset, reason: `o release ${target.tag} tem sha256 ${digest}` };
  }
  if (asset.size && asset.size !== localSize) {
    return { checked: true, stale: true, tag: target.tag, asset, reason: `o release ${target.tag} tem ${asset.size} bytes` };
  }
  return { checked: true, stale: false, tag: target.tag, asset, semDigest: true };
}

function fmt(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  const existe = existsSync(TARGET);
  const localSize = existe ? statSync(TARGET).size : 0;
  const localSha = existe ? await sha256File(TARGET) : null;

  if (checkOnly) {
    if (!existe) {
      console.error(`Não existe binário em ${TARGET}. Rode sem --check para baixar.`);
      process.exit(1);
    }
    const info = await checkFreshness(localSha, localSize, url);
    if (!info.checked) {
      console.error(`Não deu para conferir o release: ${info.reason}`);
      process.exit(2);
    }
    if (info.stale) {
      console.error(`DESATUALIZADO: ${info.reason}; local tem sha256 ${localSha}.`);
      console.error('Rode `npm run kraken:download -- --force` para atualizar.');
      process.exit(1);
    }
    console.log(`Atualizado: ${fmt(localSize)}, igual ao release ${info.tag}${info.semDigest ? ' (comparado por tamanho)' : ''}.`);
    console.log(`sha256 ${localSha}`);
    return;
  }

  if (existe && !force) {
    if (expected && localSha !== expected) {
      console.error('O arquivo local não bate com KRAKEN_EXE_SHA256. Use --force para rebaixar.');
      process.exit(1);
    }
    const info = await checkFreshness(localSha, localSize, url);
    if (info.checked && info.stale) {
      console.error(`DESATUALIZADO: ${info.reason}, mas o local tem sha256 ${localSha}.`);
      console.error('Rode `npm run kraken:download -- --force` para atualizar.');
      process.exit(1);
    }
    if (!info.checked) {
      console.warn(`Aviso: não deu para conferir o release (${info.reason}).`);
    }
    console.log(`Já existe: ${TARGET} (${fmt(localSize)})`);
    console.log(`sha256 ${localSha}`);
    return;
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

main().catch((error) => {
  console.error(`Falha no download: ${error.message}`);
  process.exit(1);
});
