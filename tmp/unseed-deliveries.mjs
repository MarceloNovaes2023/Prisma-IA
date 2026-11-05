import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/fluxo.db");

// Remove apenas o que foi semeado: entregas e alertas de fonte das ids 29..36,
// criados pelo tmp/seed-deliveries.mjs.
const IDS = [29, 30, 31, 32, 33, 34, 35, 36];
const placeholders = IDS.map(() => "?").join(",");

const sends = db.prepare(`DELETE FROM radar_alert_sends WHERE alert_id IN (${placeholders})`).run(...IDS).changes;
const alerts = db.prepare(`DELETE FROM radar_alerts WHERE id IN (${placeholders})`).run(...IDS).changes;

console.log(`Removidos: ${sends} entrega(s) e ${alerts} alerta(s) de fonte.`);
console.log("radar_alert_sends restantes:", db.prepare("SELECT COUNT(*) AS n FROM radar_alert_sends").get().n);
console.log(
  "alertas de fonte restantes:",
  db
    .prepare(
      "SELECT COUNT(*) AS n FROM radar_alerts WHERE kind IN ('source_down','source_ok','source_error_rate')",
    )
    .get().n,
);
console.log("total de alertas:", db.prepare("SELECT COUNT(*) AS n FROM radar_alerts").get().n);
