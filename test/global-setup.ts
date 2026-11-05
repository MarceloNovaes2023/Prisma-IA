import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

// Sobe o duplo local da Graph API (scripts/meta-stub.cjs) durante a suíte,
// para `npm test` não depender de um stub rodando na mão.
// - Se a porta já estiver atendendo, reaproveita (não mata processo de ninguém).
// - Se META_GRAPH_BASE_URL apontar para fora de 127.0.0.1:<porta>, não sobe nada.
// - Ao terminar a suíte, derruba apenas o processo que este setup criou.

const HOST = "127.0.0.1";
const PORT = Number(process.env.META_STUB_PORT ?? 4010);
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

function graphBase(): string {
  return (process.env.META_GRAPH_BASE_URL?.trim() || `http://${HOST}:${PORT}`).replace(/\/+$/, "");
}

function pointsAtStub(): boolean {
  try {
    const url = new URL(graphBase());
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) && port === PORT;
  } catch {
    return false;
  }
}

async function stubResponding(timeoutMs = 800): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${graphBase()}/v26.0/ads_archive?access_token=test-token&ad_reached_channels=BR&limit=10`,
      { signal: controller.signal },
    );
    await response.body?.cancel();
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitUntilReady(child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    if (await stubResponding()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    `meta-stub não ficou pronto em ${HOST}:${PORT}. Saída do processo:\n${output() || "(sem saída)"}`,
  );
}

function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  if (!pointsAtStub()) {
    console.log(`[meta-stub] testes apontam para ${graphBase()} — stub local não será iniciado.`);
    return undefined;
  }

  if (await stubResponding()) {
    console.log(`[meta-stub] já existe um processo atendendo em ${HOST}:${PORT} — reaproveitando.`);
    return undefined;
  }

  const chunks: string[] = [];
  const child = spawn(process.execPath, ["scripts/meta-stub.cjs"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, META_STUB_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));

  try {
    await waitUntilReady(child, () => chunks.join("").slice(-2000));
  } catch (error) {
    await stop(child);
    throw error;
  }

  console.log(`[meta-stub] iniciado em ${HOST}:${PORT} (pid ${child.pid}).`);
  return async () => {
    await stop(child);
  };
}
