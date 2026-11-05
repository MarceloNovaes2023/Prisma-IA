import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { radarDb } from "@/lib/radar/db";
import { dispatchSourceAlerts, pendingCounts } from "@/lib/radar/notices";
import { recordSourceTransition } from "@/lib/radar/sync-alerts";
import { nowStamp } from "@/lib/format";
import { cleanupTestDatabase, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();

const ENV_KEYS = ["RADAR_ALERT_WHATSAPP", "RADAR_ALERT_EMAIL", "RADAR_ALERTS_AUTO", "RESEND_API_KEY"] as const;

function reset() {
  const db = radarDb();
  db.exec("DELETE FROM radar_alert_sends; DELETE FROM radar_alerts; DELETE FROM radar_syncs;");
}

/** Registra uma execução como o runSync faz antes de a transição ser avaliada. */
function pushSync(source: string, status: "ok" | "error" | "skipped", message = "") {
  radarDb()
    .prepare(
      `INSERT INTO radar_syncs (source, status, fetched, inserted, updated, cursor, message, started_at, finished_at, duration_ms)
       VALUES (?, ?, 0, 0, 0, NULL, ?, ?, ?, 10)`,
    )
    .run(source, status, message, nowStamp(), nowStamp());
}

function alerts() {
  return radarDb()
    .prepare("SELECT kind, detail FROM radar_alerts WHERE kind IN ('source_down', 'source_ok') ORDER BY id")
    .all() as {
    kind: string;
    detail: string;
  }[];
}

beforeEach(() => {
  reset();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("aviso automático de fonte caída/recuperada", () => {
  it("registra a queda uma única vez, sem repetir a cada execução", () => {
    pushSync("sandbox", "ok");
    pushSync("sandbox", "error", "HTTP 500 na Graph API");
    expect(recordSourceTransition("sandbox", { status: "error", message: "HTTP 500 na Graph API" })).toBe("source_down");
    expect(alerts()).toHaveLength(1);

    pushSync("sandbox", "error", "HTTP 500 na Graph API");
    expect(recordSourceTransition("sandbox", { status: "error", message: "HTTP 500 na Graph API" })).toBeNull();
    expect(alerts()).toHaveLength(1);
  });

  it("avisa a recuperação com o número de falhas seguidas", () => {
    pushSync("sandbox", "ok");
    pushSync("sandbox", "error", "timeout");
    recordSourceTransition("sandbox", { status: "error", message: "timeout" });
    pushSync("sandbox", "error", "timeout");
    recordSourceTransition("sandbox", { status: "error", message: "timeout" });

    pushSync("sandbox", "ok", "12 novos");
    expect(recordSourceTransition("sandbox", { status: "ok", message: "12 novos" })).toBe("source_ok");

    const kinds = alerts().map((alert) => alert.kind);
    expect(kinds).toEqual(["source_down", "source_ok"]);
    expect(alerts()[1].detail).toContain("após 2 falha(s)");
  });

  it("fonte sem credencial (skipped) não gera alerta", () => {
    pushSync("sandbox", "error", "timeout");
    pushSync("sandbox", "skipped", "configure o token");
    expect(recordSourceTransition("sandbox", { status: "skipped", message: "configure o token" })).toBeNull();
    expect(alerts()).toHaveLength(0);
  });

  it("dispara sozinho no canal configurado, sem clique no painel", async () => {
    process.env.RADAR_ALERT_WHATSAPP = "+55 62 90000-0000";
    pushSync("sandbox", "ok");
    pushSync("sandbox", "error", "HTTP 500");
    recordSourceTransition("sandbox", { status: "error", message: "HTTP 500" });

    const deliveries = await dispatchSourceAlerts();

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ channel: "whatsapp", sent: 1, ok: true });
    expect(pendingCounts().whatsapp).toBe(0);

    // segunda rodada não reenvia o que já saiu
    const again = await dispatchSourceAlerts();
    expect(again[0].sent).toBe(0);
  });

  it("não envia nada quando não há destino configurado", async () => {
    pushSync("sandbox", "error");
    recordSourceTransition("sandbox", { status: "error", message: "boom" });
    expect(await dispatchSourceAlerts()).toEqual([]);
    expect(pendingCounts().whatsapp).toBe(1);
  });

  it("respeita RADAR_ALERTS_AUTO=off", async () => {
    process.env.RADAR_ALERT_WHATSAPP = "+55 62 90000-0000";
    process.env.RADAR_ALERTS_AUTO = "off";
    pushSync("sandbox", "error");
    recordSourceTransition("sandbox", { status: "error", message: "boom" });
    expect(await dispatchSourceAlerts()).toEqual([]);
    expect(pendingCounts().whatsapp).toBe(1);
  });

  it("não martela o provedor depois de uma falha recente", async () => {
    process.env.RADAR_ALERT_WHATSAPP = "+55 62 90000-0000";
    pushSync("sandbox", "error");
    recordSourceTransition("sandbox", { status: "error", message: "boom" });

    const alertId = (radarDb().prepare("SELECT id FROM radar_alerts LIMIT 1").get() as { id: number }).id;
    radarDb()
      .prepare(
        `INSERT INTO radar_alert_sends (alert_id, channel, destination, status, provider_id, error, created_at)
         VALUES (?, 'whatsapp', '+55 62 90000-0000', 'failed', NULL, 'timeout no provedor', ?)`,
      )
      .run(alertId, nowStamp());

    const deliveries = await dispatchSourceAlerts();
    expect(deliveries[0].sent).toBe(0);
    expect(deliveries[0].message).toContain("15 min");
    expect(pendingCounts().whatsapp).toBe(1);
  });
});
