import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { radarDb } from "@/lib/radar/db";
import {
  SYNC_LOCK_NAME,
  acquireSyncLease,
  releaseSyncLease,
  renewSyncLease,
  syncLease,
} from "@/lib/radar/lock";
import { cleanupTestDatabase, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();
const INSTANCE_A = "instancia-a:1111:aaaa";
const INSTANCE_B = "instancia-b:2222:bbbb";

function clearLock() {
  radarDb().prepare("DELETE FROM radar_sync_lock").run();
}

function expireLock() {
  radarDb()
    .prepare("UPDATE radar_sync_lock SET expires_at_ms = ? WHERE name = ?")
    .run(Date.now() - 1, SYNC_LOCK_NAME);
}

beforeAll(() => {
  radarDb();
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("trava de sincronização no banco", () => {
  it("dá o lease para uma instância só", () => {
    clearLock();

    expect(acquireSyncLease(INSTANCE_A, 60_000)).toBe(true);
    expect(acquireSyncLease(INSTANCE_B, 60_000)).toBe(false);
    expect(syncLease()).toMatchObject({ owner: INSTANCE_A });
  });

  it("libera a rodada seguinte depois que o lease vence", () => {
    clearLock();
    expect(acquireSyncLease(INSTANCE_A, 60_000)).toBe(true);
    expireLock();

    expect(acquireSyncLease(INSTANCE_B, 60_000)).toBe(true);
    expect(syncLease().owner).toBe(INSTANCE_B);
  });

  it("renova só com o dono e estende a validade", () => {
    clearLock();
    expect(acquireSyncLease(INSTANCE_A, 1_000)).toBe(true);

    expect(renewSyncLease(INSTANCE_B, 60_000)).toBe(false);
    expect(renewSyncLease(INSTANCE_A, 60_000)).toBe(true);
    expect(syncLease().expiresAtMs ?? 0).toBeGreaterThan(Date.now() + 30_000);
  });

  it("não solta a trava de outra instância", () => {
    clearLock();
    expect(acquireSyncLease(INSTANCE_A, 60_000)).toBe(true);

    releaseSyncLease(INSTANCE_B);
    expect(syncLease().owner).toBe(INSTANCE_A);

    releaseSyncLease(INSTANCE_A);
    expect(syncLease().owner).toBeNull();
  });

  it("vale entre conexões diferentes — o caso de duas instâncias do app", () => {
    clearLock();

    // segunda conexão no mesmo arquivo, como um outro processo faria
    const other = new DatabaseSync(dbFile);
    try {
      other.exec("PRAGMA busy_timeout = 5000;");
      expect(acquireSyncLease(INSTANCE_A, 60_000)).toBe(true);

      const nowMs = Date.now();
      const attempt = other
        .prepare(
          `INSERT INTO radar_sync_lock (name, owner, acquired_at, expires_at_ms)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET
             owner = excluded.owner,
             acquired_at = excluded.acquired_at,
             expires_at_ms = excluded.expires_at_ms
           WHERE radar_sync_lock.expires_at_ms <= ?`,
        )
        .run(SYNC_LOCK_NAME, INSTANCE_B, "2026-10-31 10:00:00", nowMs + 60_000, nowMs);

      expect(attempt.changes).toBe(0);
      expect(syncLease().owner).toBe(INSTANCE_A);
    } finally {
      other.close();
    }
  });
});
