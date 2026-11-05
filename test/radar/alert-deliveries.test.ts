import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { radarDb } from "@/lib/radar/db";
import { deliveredSources, dispatchSourceAlerts, sourceDeliveries } from "@/lib/radar/notices";
import { recordSourceTransition } from "@/lib/radar/sync-alerts";
import { nowStamp } from "@/lib/format";
import { cleanupTestDatabase, seedRadarFixtures, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();

function push(source: string, status: "ok" | "error" | "skipped", message = "") {
  radarDb()
    .prepare(
      `INSERT INTO radar_syncs (source, status, fetched, inserted, updated, cursor, message, started_at, finished_at, duration_ms)
       VALUES (?, ?, 0, 0, 0, NULL, ?, ?, ?, 10)`,
    )
    .run(source, status, message, nowStamp(), nowStamp());
}

beforeEach(() => {
  seedRadarFixtures();
  radarDb().exec("DELETE FROM radar_alert_sends; DELETE FROM radar_alerts; DELETE FROM radar_syncs;");
  process.env.RADAR_ALERT_WHATSAPP = "+55 62 90000-0000";
  delete process.env.RADAR_ALERT_EMAIL;
  delete process.env.RADAR_ALERTS_AUTO;
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
  delete process.env.RADAR_ALERT_WHATSAPP;
});

describe("histórico de avisos de fonte entregues", () => {
  it("guarda a fonte no alerta e mostra canal e horário do envio", async () => {
    push("meta", "ok");
    push("meta", "error", "HTTP 500");
    recordSourceTransition("meta", { status: "error", message: "HTTP 500" });

    const deliveries = await dispatchSourceAlerts();
    expect(deliveries[0]).toMatchObject({ channel: "whatsapp", ok: true, sent: 1 });

    const rows = sourceDeliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "source_down",
      source: "meta",
      channel: "whatsapp",
      destination: "+55 62 90000-0000",
      status: "sent",
    });
    expect(rows[0].detail).toContain("Meta Ad Library");
    expect(rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("filtra por fonte e agrupa as fontes que já entregaram", async () => {
    push("meta", "ok");
    push("meta", "error", "HTTP 500");
    recordSourceTransition("meta", { status: "error", message: "HTTP 500" });

    push("tiktok", "ok");
    push("tiktok", "error", "Rate limit");
    recordSourceTransition("tiktok", { status: "error", message: "Rate limit" });

    await dispatchSourceAlerts();

    expect(sourceDeliveries({ source: "meta" }).map((row) => row.source)).toEqual(["meta"]);
    expect(sourceDeliveries({ source: "tiktok" }).map((row) => row.source)).toEqual(["tiktok"]);
    expect(sourceDeliveries({ source: "sandbox" })).toHaveLength(0);
    expect(sourceDeliveries()).toHaveLength(2);

    const grouped = deliveredSources();
    expect(grouped.map((item) => item.source).sort()).toEqual(["meta", "tiktok"]);
    expect(grouped.every((item) => item.deliveries === 1 && item.last_at.length === 19)).toBe(true);
  });

  it("não mistura avisos de anúncio com avisos de fonte", async () => {
    radarDb()
      .prepare("INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, created_at) VALUES ('new_ad', NULL, NULL, 'Anúncio novo', ?)")
      .run(nowStamp());
    const adAlert = (radarDb().prepare("SELECT MAX(id) AS id FROM radar_alerts").get() as { id: number }).id;
    radarDb()
      .prepare(
        `INSERT INTO radar_alert_sends (alert_id, channel, destination, status, created_at)
         VALUES (?, 'whatsapp', '+55 62 90000-0000', 'sent', ?)`,
      )
      .run(adAlert, nowStamp());

    expect(sourceDeliveries()).toHaveLength(0);
    expect(deliveredSources()).toHaveLength(0);
  });
});
