import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/radar/sync/route";
import { radarDb } from "@/lib/radar/db";
import { acquireSyncLease, SYNC_LOCK_NAME, syncLease } from "@/lib/radar/lock";
import { cleanupTestDatabase, getRequest, seedRadarFixtures, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();

function clearLock() {
  radarDb().prepare("DELETE FROM radar_sync_lock").run();
}

function syncCount(): number {
  return (radarDb().prepare("SELECT COUNT(*) AS n FROM radar_syncs").get() as { n: number }).n;
}

function setLease(owner: string, expiresAtMs: number) {
  radarDb()
    .prepare(
      `INSERT INTO radar_sync_lock (name, owner, acquired_at, expires_at_ms)
       VALUES (?, ?, '2026-11-02 10:00:00', ?)
       ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, expires_at_ms = excluded.expires_at_ms`,
    )
    .run(SYNC_LOCK_NAME, owner, expiresAtMs);
}

beforeEach(() => {
  seedRadarFixtures();
  radarDb().exec("DELETE FROM radar_syncs; DELETE FROM radar_alerts; DELETE FROM radar_alert_sends;");
  clearLock();
  delete process.env.RADAR_API_KEY;
  delete process.env.INTAKE_API_KEY;
  delete process.env.RADAR_ALERT_WHATSAPP;
  delete process.env.RADAR_ALERT_EMAIL;
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("sincronização manual sob a trava do banco", () => {
  it("recusa com 409 e aviso claro quando outra instância segura a trava", async () => {
    setLease("outra-maquina:4242:abcd1234", Date.now() + 10 * 60_000);
    const before = syncCount();

    const response = await POST(getRequest("/sync?fonte=sandbox"));
    const body = (await response.json()) as {
      error: string;
      message: string;
      holder: string;
      retryAfterSeconds: number;
    };

    expect(response.status).toBe(409);
    expect(body.error).toBe("sync_busy");
    expect(body.holder).toBe("outra-maquina:4242:abcd1234");
    expect(body.message).toContain("outra-maquina");
    expect(body.message).toContain("em até");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(response.headers.get("retry-after")).toBe(String(body.retryAfterSeconds));
    // nada foi sincronizado e a trava de quem já estava rodando continua intacta
    expect(syncCount()).toBe(before);
    expect(syncLease().owner).toBe("outra-maquina:4242:abcd1234");
  });

  it("sincroniza quando a trava está livre e a devolve no fim", async () => {
    const response = await POST(getRequest("/sync?fonte=sandbox"));
    expect(response.status).toBe(200);
    expect(syncCount()).toBe(1);
    expect(syncLease().owner).toBeNull();
  });

  it("ignora uma trava expirada — instância morta não bloqueia o time", async () => {
    setLease("outra-maquina:4242:abcd1234", Date.now() - 1000);

    const response = await POST(getRequest("/sync?fonte=sandbox"));

    expect(response.status).toBe(200);
    expect(syncCount()).toBe(1);
    expect(syncLease().owner).toBeNull();
  });

  it("duas chamadas seguidas não se sobrepõem: a segunda espera a trava sair", async () => {
    acquireSyncLease("instancia-b:9999:ffffffff", 60_000);

    const blocked = await POST(getRequest("/sync?fonte=sandbox"));
    expect(blocked.status).toBe(409);

    clearLock();
    const allowed = await POST(getRequest("/sync?fonte=sandbox"));
    expect(allowed.status).toBe(200);
  });
});
