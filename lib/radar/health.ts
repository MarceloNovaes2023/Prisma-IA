import { radarDb } from "./db";
import { dateOnly } from "./score";

export type DailyCollectHealth = {
  day: string;
  inserted: number;
  updated: number;
  runs: number;
  errors: number;
  avgMs: number;
};

export type SourceHealth = {
  source: string;
  runs: number;
  errors: number;
  skipped: number;
  errorRate: number;
  inserted: number;
  updated: number;
  avgMs: number;
  p95Ms: number;
  lastErrorAt: string | null;
  lastError: string | null;
};

type SyncRow = {
  source: string;
  status: string;
  inserted: number;
  updated: number;
  duration_ms: number | null;
  started_at: string;
  message: string | null;
};

function since(days: number): string {
  return `${dateOnly(Math.max(0, days - 1))} 00:00:00`;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
}

/**
 * Série diária da coleta: o que entrou, quantas execuções e quanto tempo elas
 * levaram. Dias sem execução aparecem com zero para a curva não mentir.
 */
export function dailyCollectHealth(days = 14): DailyCollectHealth[] {
  const safeDays = Math.min(90, Math.max(1, Math.round(days)));
  const rows = radarDb()
    .prepare(
      `SELECT source, status, inserted, updated, duration_ms, started_at, message
       FROM radar_syncs WHERE started_at >= ? ORDER BY started_at ASC`,
    )
    .all(since(safeDays)) as SyncRow[];

  const buckets = new Map<string, { inserted: number; updated: number; runs: number; errors: number; durations: number[] }>();

  for (const row of rows) {
    const day = row.started_at.slice(0, 10);
    const bucket = buckets.get(day) ?? { inserted: 0, updated: 0, runs: 0, errors: 0, durations: [] };
    bucket.inserted += row.inserted;
    bucket.updated += row.updated;
    bucket.runs += 1;
    if (row.status === "error") bucket.errors += 1;
    if (typeof row.duration_ms === "number") bucket.durations.push(row.duration_ms);
    buckets.set(day, bucket);
  }

  const series: DailyCollectHealth[] = [];
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const day = dateOnly(offset);
    const bucket = buckets.get(day);
    series.push({
      day,
      inserted: bucket?.inserted ?? 0,
      updated: bucket?.updated ?? 0,
      runs: bucket?.runs ?? 0,
      errors: bucket?.errors ?? 0,
      avgMs: average(bucket?.durations ?? []),
    });
  }
  return series;
}

/** Falhas, volume e latência por fonte na janela analisada. */
export function sourceHealth(days = 30): SourceHealth[] {
  const safeDays = Math.min(180, Math.max(1, Math.round(days)));
  const rows = radarDb()
    .prepare(
      `SELECT source, status, inserted, updated, duration_ms, started_at, message
       FROM radar_syncs WHERE started_at >= ? ORDER BY started_at ASC`,
    )
    .all(since(safeDays)) as SyncRow[];

  const grouped = new Map<
    string,
    {
      runs: number;
      errors: number;
      skipped: number;
      inserted: number;
      updated: number;
      durations: number[];
      lastErrorAt: string | null;
      lastError: string | null;
    }
  >();

  for (const row of rows) {
    const entry =
      grouped.get(row.source) ??
      { runs: 0, errors: 0, skipped: 0, inserted: 0, updated: 0, durations: [], lastErrorAt: null, lastError: null };
    entry.runs += 1;
    entry.inserted += row.inserted;
    entry.updated += row.updated;
    if (row.status === "error") {
      entry.errors += 1;
      entry.lastErrorAt = row.started_at;
      entry.lastError = row.message;
    }
    if (row.status === "skipped") entry.skipped += 1;
    if (typeof row.duration_ms === "number") entry.durations.push(row.duration_ms);
    grouped.set(row.source, entry);
  }

  return [...grouped.entries()]
    .map(([source, entry]) => ({
      source,
      runs: entry.runs,
      errors: entry.errors,
      skipped: entry.skipped,
      errorRate: entry.runs === 0 ? 0 : (entry.errors / entry.runs) * 100,
      inserted: entry.inserted,
      updated: entry.updated,
      avgMs: average(entry.durations),
      p95Ms: percentile(entry.durations, 0.95),
      lastErrorAt: entry.lastErrorAt,
      lastError: entry.lastError,
    }))
    .sort((a, b) => b.errors - a.errors || b.runs - a.runs);
}
