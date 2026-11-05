import { radarDb } from "./db";
import { recordErrorRateAlert, sourceLabel } from "./error-rate";
import { recordSyncInsight } from "./insights";
import { acquireSyncLease, releaseSyncLease, syncLease, syncOwnerId } from "./lock";
import { dispatchSourceAlerts, type DeliveryResult } from "./notices";
import { runSync, type SyncOptions, type SyncResult } from "./sources/sync";
import { insertAlert } from "./track";

function previousStatus(source: string): string | null {
  // o runSync já gravou a execução atual; a anterior é a segunda linha
  const rows = radarDb()
    .prepare("SELECT status FROM radar_syncs WHERE source = ? ORDER BY id DESC LIMIT 2")
    .all(source) as { status: string }[];
  return rows[1]?.status ?? null;
}

function failureStreak(source: string): number {
  const rows = radarDb()
    .prepare("SELECT status FROM radar_syncs WHERE source = ? ORDER BY id DESC LIMIT 10")
    .all(source) as { status: string }[];
  let streak = 0;
  // rows[0] é a execução atual (já recuperada); conta as falhas anteriores a ela
  for (const row of rows.slice(1)) {
    if (row.status !== "error") break;
    streak++;
  }
  return streak;
}

/**
 * Detecta a virada de estado da fonte e registra o alerta uma única vez:
 * falha depois de sucesso vira `source_down`, sucesso depois de falha vira
 * `source_ok`. Execuções puladas (fonte sem credencial) não geram alerta.
 */
export function recordSourceTransition(
  source: string,
  result: Pick<SyncResult, "status" | "message">,
): "source_down" | "source_ok" | null {
  if (result.status === "skipped") return null;

  const label = sourceLabel(source);
  const before = previousStatus(source);

  if (result.status === "error") {
    if (before === "error") return null;
    insertAlert("source_down", null, null, `${label} parou de sincronizar: ${result.message}`, source);
    return "source_down";
  }

  if (before !== "error") return null;
  const streak = failureStreak(source);
  insertAlert("source_ok", null, null, `${label} voltou a sincronizar após ${streak} falha(s) seguida(s).`, source);
  return "source_ok";
}

export type SyncWithAlerts = { result: SyncResult; dispatched: DeliveryResult[] };

export type SyncBusy = {
  busy: true;
  holder: string | null;
  minutesLeft: number;
  message: string;
};

export type LeasedSync = SyncBusy | ({ busy: false } & SyncWithAlerts);

/** Dono do lease das sincronizações manuais (botão do painel e endpoint). */
const MANUAL_OWNER = syncOwnerId();

function busyNotice(): SyncBusy {
  const lease = syncLease();
  const minutesLeft = Math.max(1, Math.ceil(((lease.expiresAtMs ?? 0) - Date.now()) / 60_000));
  const [host, pid] = (lease.owner ?? "").split(":");
  const where = host ? `${host}${pid ? ` (pid ${pid})` : ""}` : "outra instância";
  return {
    busy: true,
    holder: lease.owner,
    minutesLeft,
    message: `Outra sincronização está em andamento em ${where}. A trava se libera em até ${minutesLeft} min — tente de novo depois.`,
  };
}

/**
 * Sincronização manual sob a mesma trava do agendador: se outra instância já
 * está rodando, devolve o aviso em vez de duplicar a coleta.
 */
export async function runSyncLeased(source: string, options: SyncOptions = {}): Promise<LeasedSync> {
  if (!acquireSyncLease(MANUAL_OWNER)) return busyNotice();

  try {
    const outcome = await runSyncNotifying(source, options);
    return { busy: false, ...outcome };
  } finally {
    releaseSyncLease(MANUAL_OWNER);
  }
}

/**
 * Sincroniza e, na mesma passada, dispara os avisos de queda/recuperação nos
 * canais configurados — sem depender de ninguém clicar no painel.
 */
export async function runSyncNotifying(source: string, options: SyncOptions = {}): Promise<SyncWithAlerts> {
  const result = await runSync(source, options);
  recordSourceTransition(source, result);
  // taxa de falha acima do limite no período também entra no mesmo canal de aviso
  recordErrorRateAlert(source);
  // leitura do que entrou, gerada junto da coleta (simulada quando não há chave de IA)
  if (result.status === "ok") {
    await recordSyncInsight({ source, inserted: result.inserted, updated: result.updated });
  }
  const dispatched = await dispatchSourceAlerts();
  return { result, dispatched };
}
