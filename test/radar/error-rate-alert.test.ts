import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { radarDb } from "@/lib/radar/db";
import { errorRateConfig, evaluateErrorRate, recordErrorRateAlert } from "@/lib/radar/error-rate";
import { dispatchSourceAlerts, pendingCounts } from "@/lib/radar/notices";
import { nowStamp } from "@/lib/format";
import { cleanupTestDatabase, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();

const ENV_KEYS = [
  "RADAR_ALERT_WHATSAPP",
  "RADAR_ALERT_EMAIL",
  "RADAR_ALERTS_AUTO",
  "RADAR_ERROR_RATE_THRESHOLD",
  "RADAR_ERROR_RATE_WINDOW",
  "RADAR_ERROR_RATE_MIN_RUNS",
] as const;

function push(source: string, status: "ok" | "error" | "skipped", message = "") {
  radarDb()
    .prepare(
      `INSERT INTO radar_syncs (source, status, fetched, inserted, updated, cursor, message, started_at, finished_at, duration_ms)
       VALUES (?, ?, 0, 0, 0, NULL, ?, ?, ?, 10)`,
    )
    .run(source, status, message, nowStamp(), nowStamp());
}

function rateAlerts() {
  return radarDb()
    .prepare("SELECT detail FROM radar_alerts WHERE kind = 'source_error_rate' ORDER BY id")
    .all() as { detail: string }[];
}

beforeEach(() => {
  radarDb().exec("DELETE FROM radar_alert_sends; DELETE FROM radar_alerts; DELETE FROM radar_syncs;");
  for (const key of ENV_KEYS) delete process.env[key];
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("aviso por taxa de falha da fonte", () => {
  it("não avalia antes da amostra mínima", () => {
    push("meta", "ok");
    push("meta", "error", "timeout");
    push("meta", "error", "timeout");
    expect(errorRateConfig()).toMatchObject({ threshold: 25, window: 10, minRuns: 4 });
    expect(evaluateErrorRate("meta")).toBeNull();
  });

  it("não alerta quando a taxa fica abaixo do limite", () => {
    for (let index = 0; index < 9; index += 1) push("meta", "ok");
    push("meta", "error", "HTTP 500");
    const evaluation = evaluateErrorRate("meta");
    expect(evaluation).toMatchObject({ runs: 10, errors: 1, triggered: false });
    expect(recordErrorRateAlert("meta")).toBeNull();
    expect(rateAlerts()).toHaveLength(0);
  });

  it("alerta na subida acima do limite e não repete enquanto segue instável", () => {
    for (let index = 0; index < 5; index += 1) push("meta", "ok");
    expect(recordErrorRateAlert("meta")).toBeNull();

    push("meta", "error", "Timeout na Graph API");
    expect(recordErrorRateAlert("meta")).toBeNull(); // 1/6 = 16,7% — ainda abaixo

    push("meta", "error", "Timeout na Graph API");
    const evaluation = recordErrorRateAlert("meta"); // 2/7 = 28,6% — passou do limite
    expect(evaluation).toMatchObject({ runs: 7, errors: 2, triggered: true });
    expect(rateAlerts()).toHaveLength(1);
    expect(rateAlerts()[0].detail).toContain("Meta Ad Library falhou 2 de 7");
    expect(rateAlerts()[0].detail).toContain("29%");
    expect(rateAlerts()[0].detail).toContain("Timeout na Graph API");

    push("meta", "error", "Timeout na Graph API");
    expect(recordErrorRateAlert("meta")).toBeNull();
    expect(rateAlerts()).toHaveLength(1);
  });

  it("ignora execuções puladas na conta", () => {
    for (let index = 0; index < 4; index += 1) push("tiktok", "ok");
    for (let index = 0; index < 4; index += 1) push("tiktok", "skipped", "sem credencial");
    expect(evaluateErrorRate("tiktok")).toMatchObject({ runs: 4, errors: 0, triggered: false });
  });

  it("limite 0 desliga o aviso", () => {
    process.env.RADAR_ERROR_RATE_THRESHOLD = "0";
    for (let index = 0; index < 4; index += 1) push("meta", "error", "boom");
    expect(evaluateErrorRate("meta")).toBeNull();
  });

  it("reaproveita o envio por WhatsApp do painel de alertas", async () => {
    process.env.RADAR_ALERT_WHATSAPP = "+55 62 90000-0000";
    for (let index = 0; index < 5; index += 1) push("meta", "ok");
    push("meta", "error", "HTTP 500");
    push("meta", "error", "HTTP 500");
    recordErrorRateAlert("meta");

    expect(pendingCounts().whatsapp).toBe(1);
    const deliveries = await dispatchSourceAlerts();
    expect(deliveries[0]).toMatchObject({ channel: "whatsapp", sent: 1, ok: true });
    expect(pendingCounts().whatsapp).toBe(0);
  });
});
