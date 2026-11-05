import { bingConfigured } from "./sources/bing";
import { metaConfigured } from "./sources/meta";
import { tiktokConfigured } from "./sources/tiktok";

export type SchedulerState = {
  startedAt: string | null;
  lastRun: string | null;
  lastSummary: string | null;
  running: boolean;
  runs: number;
  failures: number;
};

const globalForScheduler = globalThis as unknown as {
  __radarScheduler?: { timer: ReturnType<typeof setInterval>; boot: ReturnType<typeof setTimeout> };
  __radarSchedulerState?: SchedulerState;
  __radarSyncing?: boolean;
};

export function schedulerState(): SchedulerState {
  globalForScheduler.__radarSchedulerState ??= {
    startedAt: null,
    lastRun: null,
    lastSummary: null,
    running: false,
    runs: 0,
    failures: 0,
  };
  return globalForScheduler.__radarSchedulerState;
}

export type SchedulerConfig = { enabled: boolean; intervalMs: number; minutes: number };

/** Intervalo fixo. `RADAR_SYNC_INTERVAL_SECONDS` existe só para testes rápidos. */
export function schedulerConfig(): SchedulerConfig {
  const seconds = Number(process.env.RADAR_SYNC_INTERVAL_SECONDS ?? 0);
  const minutes = Number(process.env.RADAR_SYNC_INTERVAL_MINUTES ?? 360);
  const intervalMs =
    Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : Math.max(60_000, (Number.isFinite(minutes) && minutes > 0 ? minutes : 360) * 60_000);

  return {
    enabled: process.env.RADAR_SYNC_ENABLED !== "false",
    intervalMs,
    minutes: Math.round(intervalMs / 60_000),
  };
}

/** Só fonte real entra na varredura automática — a base de demonstração não se autoalimenta. */
export function scheduledSources(): string[] {
  const sources: string[] = [];
  if (metaConfigured()) sources.push("meta");
  if (tiktokConfigured()) sources.push("tiktok");
  // a Microsoft Ad Library não pede token: entra no ciclo automático por padrão
  if (bingConfigured()) sources.push("bing");
  return sources;
}

export function isSchedulerRunning(): boolean {
  return Boolean(globalForScheduler.__radarScheduler);
}

export function schedulerHandle() {
  return globalForScheduler.__radarScheduler;
}

export function setSchedulerHandle(handle: { timer: ReturnType<typeof setInterval>; boot: ReturnType<typeof setTimeout> } | undefined) {
  globalForScheduler.__radarScheduler = handle;
}

export function isSyncing(): boolean {
  return Boolean(globalForScheduler.__radarSyncing);
}

export function setSyncing(value: boolean) {
  globalForScheduler.__radarSyncing = value;
}

export type SchedulerSnapshot = SchedulerConfig & {
  started: boolean;
  sources: string[];
  running: boolean;
  startedAt: string | null;
  lastRun: string | null;
  lastSummary: string | null;
  runs: number;
  failures: number;
  nextRunAt: string | null;
};

export function schedulerSnapshot(): SchedulerSnapshot {
  const config = schedulerConfig();
  const current = schedulerState();
  const started = isSchedulerRunning();

  let nextRunAt: string | null = null;
  if (started) {
    const base = current.lastRun ? new Date(`${current.lastRun.replace(" ", "T")}Z`).getTime() : Date.now();
    nextRunAt = new Date(base + config.intervalMs).toISOString().slice(0, 19).replace("T", " ");
  }

  return {
    ...config,
    started,
    sources: scheduledSources(),
    running: current.running,
    startedAt: current.startedAt,
    lastRun: current.lastRun,
    lastSummary: current.lastSummary,
    runs: current.runs,
    failures: current.failures,
    nextRunAt,
  };
}
