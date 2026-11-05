import { radarDb } from "./db";
import { insertAlert } from "./track";

const LABELS: Record<string, string> = {
  meta: "Meta Ad Library",
  tiktok: "TikTok Commercial Content",
  bing: "Microsoft Ad Library",
  sandbox: "Base de demonstração",
  import: "Importação",
};

export function sourceLabel(source: string): string {
  return LABELS[source] ?? source;
}

export type ErrorRateConfig = {
  /** Percentual a partir do qual a fonte é considerada instável. 0 desliga. */
  threshold: number;
  /** Quantas execuções recentes entram na conta. */
  window: number;
  /** Amostra mínima: com poucas execuções a taxa mente. */
  minRuns: number;
};

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.round(value));
}

export function errorRateConfig(): ErrorRateConfig {
  const window = positiveInt(process.env.RADAR_ERROR_RATE_WINDOW, 10, 50);
  const minRuns = Math.min(window, positiveInt(process.env.RADAR_ERROR_RATE_MIN_RUNS, 4, window));
  const raw = process.env.RADAR_ERROR_RATE_THRESHOLD?.trim();
  const parsed = raw ? Number(raw) : Number.NaN;
  const threshold = Number.isFinite(parsed) && parsed >= 0 ? parsed : 25;
  return { threshold, window, minRuns };
}

type Attempt = { status: string; message: string | null };

/** Execuções recentes da fonte, sem contar as puladas (fonte sem credencial). */
function recentAttempts(source: string, limit: number): Attempt[] {
  return radarDb()
    .prepare(
      `SELECT status, message FROM radar_syncs
       WHERE source = ? AND status <> 'skipped'
       ORDER BY id DESC LIMIT ?`,
    )
    .all(source, limit + 1) as Attempt[];
}

function rateOf(rows: Attempt[]): { runs: number; errors: number; rate: number } {
  const errors = rows.filter((row) => row.status === "error").length;
  return { runs: rows.length, errors, rate: rows.length === 0 ? 0 : (errors / rows.length) * 100 };
}

export type ErrorRateEvaluation = {
  source: string;
  runs: number;
  errors: number;
  rate: number;
  previousRate: number;
  threshold: number;
  triggered: boolean;
};

/**
 * Compara a taxa de falha da janela com a da janela anterior (sem a última
 * execução) e alerta só na subida acima do limite — sem repetir a cada rodada
 * enquanto a fonte continua instável.
 */
export function evaluateErrorRate(source: string): ErrorRateEvaluation | null {
  const config = errorRateConfig();
  if (config.threshold <= 0) return null;

  const rows = recentAttempts(source, config.window);
  if (rows.length < config.minRuns) return null;

  const current = rateOf(rows.slice(0, config.window));
  const previous = rateOf(rows.slice(1, config.window + 1));
  const crossed = current.rate > config.threshold && previous.rate <= config.threshold;

  return {
    source,
    runs: current.runs,
    errors: current.errors,
    rate: current.rate,
    previousRate: previous.rate,
    threshold: config.threshold,
    triggered: crossed,
  };
}

/**
 * Registra o alerta de "taxa de falha acima do limite" para a fonte.
 * Devolve a avaliação que gerou o alerta, ou `null` quando não há o que avisar.
 */
export function recordErrorRateAlert(source: string): ErrorRateEvaluation | null {
  const evaluation = evaluateErrorRate(source);
  if (!evaluation?.triggered) return null;

  const lastError = radarDb()
    .prepare(
      `SELECT message FROM radar_syncs WHERE source = ? AND status = 'error' ORDER BY id DESC LIMIT 1`,
    )
    .get(source) as { message: string | null } | undefined;

  const detail = [
    `${sourceLabel(source)} falhou ${evaluation.errors} de ${evaluation.runs} vez(es)`,
    `(${evaluation.rate.toFixed(0)}%, acima do limite de ${evaluation.threshold.toFixed(0)}%)`,
    lastError?.message ? `· último erro: ${lastError.message}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  insertAlert("source_error_rate", null, null, detail, source);
  return evaluation;
}
