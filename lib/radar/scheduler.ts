import { nowStamp } from "@/lib/format";
import { acquireSyncLease, releaseSyncLease, renewSyncLease, syncOwnerId } from "./lock";
import type { SyncResult } from "./sources/sync";
import { runSyncNotifying } from "./sync-alerts";
import {
  isSyncing,
  schedulerHandle,
  schedulerConfig,
  schedulerSnapshot,
  schedulerState,
  scheduledSources,
  setSchedulerHandle,
  setSyncing,
  type SchedulerSnapshot,
} from "./scheduler-state";

export { scheduledSources, schedulerConfig, schedulerSnapshot };
export type { SchedulerSnapshot };

/** Identidade desta instância na trava do banco. */
const SYNC_OWNER = syncOwnerId();

/**
 * Executa todas as fontes configuradas em sequência, uma por vez.
 * A trava vive no banco, então várias instâncias do app podem rodar o agendador:
 * só a que tomar o lease sincroniza, as outras apenas pulam a rodada.
 */
export async function runScheduledSync(): Promise<SyncResult[]> {
  if (isSyncing()) return [];
  if (!acquireSyncLease(SYNC_OWNER)) return [];
  setSyncing(true);

  const current = schedulerState();
  current.running = true;

  try {
    const sources = scheduledSources();
    if (sources.length === 0) {
      current.lastRun = nowStamp();
      current.lastSummary = "Nenhuma fonte real configurada — nada para sincronizar.";
      return [];
    }

    const results: SyncResult[] = [];
    let alerted = 0;
    for (const source of sources) {
      // renova antes de cada fonte; se outra instância tomou o lease, para aqui
      if (!renewSyncLease(SYNC_OWNER)) break;
      // sincroniza e já dispara os avisos de queda/recuperação dos canais configurados
      const { result, dispatched } = await runSyncNotifying(source);
      alerted += dispatched.reduce((acc, delivery) => acc + delivery.sent, 0);
      results.push(result);
    }

    current.runs += 1;
    current.failures += results.filter((item) => item.status === "error").length;
    current.lastRun = nowStamp();
    current.lastSummary = [
      results
        .map((item) => `${item.source}: ${item.status} (${item.inserted} novos, ${item.updated} atualizados)`)
        .join(" · "),
      alerted > 0 ? `${alerted} aviso(s) enviado(s)` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return results;
  } catch (error) {
    current.failures += 1;
    current.lastRun = nowStamp();
    current.lastSummary = error instanceof Error ? error.message : "falha desconhecida no agendador";
    return [];
  } finally {
    current.running = false;
    setSyncing(false);
    releaseSyncLease(SYNC_OWNER);
  }
}

/**
 * Liga o relógio do agendador. Idempotente: chamadas repetidas (HMR, múltiplos imports)
 * reaproveitam o timer existente.
 */
export function startRadarScheduler(): { started: boolean; reason: string } {
  const config = schedulerConfig();
  if (!config.enabled) return { started: false, reason: "RADAR_SYNC_ENABLED=false" };
  if (schedulerSnapshot().started) return { started: false, reason: "já iniciado" };

  const current = schedulerState();
  current.startedAt = nowStamp();

  const timer = setInterval(() => {
    void runScheduledSync();
  }, config.intervalMs);
  timer.unref?.();

  // primeira passada curta depois do boot, sem atrasar a subida do servidor
  const boot = setTimeout(() => {
    void runScheduledSync();
  }, 20_000);
  boot.unref?.();

  setSchedulerHandle({ timer, boot });
  return { started: true, reason: `a cada ${config.minutes} min` };
}

export function stopRadarScheduler() {
  const handle = schedulerHandle();
  if (!handle) return;
  clearInterval(handle.timer);
  clearTimeout(handle.boot);
  setSchedulerHandle(undefined);
}
