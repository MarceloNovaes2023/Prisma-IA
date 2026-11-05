import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { nowStamp } from "@/lib/format";
import { radarDb } from "./db";

/**
 * Trava de sincronização no banco.
 *
 * O agendador roda em cada instância do app, então um booleano em memória não
 * impede duas instâncias de puxarem as fontes ao mesmo tempo. A trava é uma
 * linha única em `radar_sync_lock`, com dono e validade (lease): quem consegue
 * o UPDATE condicional executa, o resto pula a rodada. O lease expira sozinho,
 * para que uma instância morta no meio da sincronização não bloqueie o resto.
 */
export const SYNC_LOCK_NAME = "scheduler";

const DEFAULT_TTL_MS = 15 * 60_000;

export function syncLockTtlMs(): number {
  const minutes = Number(process.env.RADAR_SYNC_LOCK_TTL_MINUTES ?? 0);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : DEFAULT_TTL_MS;
}

/** Identidade desta instância/processo dentro da trava. */
export function syncOwnerId(): string {
  return `${syncInstanceId()}:${randomUUID().slice(0, 8)}`;
}

/** Prefixo comum de todos os leases deste processo: `host:pid`. */
export function syncInstanceId(): string {
  return `${hostname()}:${process.pid}`;
}

/** O lease pertence a este processo? Serve para não avisar a si mesmo. */
export function isOwnLease(owner: string | null): boolean {
  return owner !== null && owner.startsWith(`${syncInstanceId()}:`);
}

export type SyncLease = {
  name: string;
  owner: string | null;
  acquiredAt: string | null;
  expiresAtMs: number | null;
  ttlMs: number;
};

/** Tenta tomar a trava. Só uma instância recebe `true` por janela de validade. */
export function acquireSyncLease(owner: string, ttlMs = syncLockTtlMs()): boolean {
  const nowMs = Date.now();
  const result = radarDb()
    .prepare(
      `INSERT INTO radar_sync_lock (name, owner, acquired_at, expires_at_ms)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         owner = excluded.owner,
         acquired_at = excluded.acquired_at,
         expires_at_ms = excluded.expires_at_ms
       WHERE radar_sync_lock.expires_at_ms <= ?`,
    )
    .run(SYNC_LOCK_NAME, owner, nowStamp(), nowMs + ttlMs, nowMs);

  return result.changes === 1;
}

/**
 * Estende a validade enquanto a sincronização corre.
 * Devolve `false` se a trava já foi tomada por outra instância (lease vencido).
 */
export function renewSyncLease(owner: string, ttlMs = syncLockTtlMs()): boolean {
  const result = radarDb()
    .prepare("UPDATE radar_sync_lock SET expires_at_ms = ? WHERE name = ? AND owner = ?")
    .run(Date.now() + ttlMs, SYNC_LOCK_NAME, owner);
  return result.changes === 1;
}

/** Libera a trava — só se ainda for dona dela. */
export function releaseSyncLease(owner: string): void {
  radarDb()
    .prepare("DELETE FROM radar_sync_lock WHERE name = ? AND owner = ?")
    .run(SYNC_LOCK_NAME, owner);
}

/** Estado atual da trava, para diagnóstico no painel. */
export function syncLease(): SyncLease {
  const ttlMs = syncLockTtlMs();
  const row = radarDb()
    .prepare("SELECT owner, acquired_at, expires_at_ms FROM radar_sync_lock WHERE name = ?")
    .get(SYNC_LOCK_NAME) as { owner: string; acquired_at: string; expires_at_ms: number } | undefined;

  return {
    name: SYNC_LOCK_NAME,
    owner: row?.owner ?? null,
    acquiredAt: row?.acquired_at ?? null,
    expiresAtMs: row?.expires_at_ms ?? null,
    ttlMs,
  };
}

/** A trava está ativa (alguém sincronizando) neste instante? */
export function syncLeaseHeldByOther(owner: string): boolean {
  const current = syncLease();
  return current.owner !== null && current.owner !== owner && (current.expiresAtMs ?? 0) > Date.now();
}
