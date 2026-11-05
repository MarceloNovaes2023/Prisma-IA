import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/fluxo.db");

db.exec(`
CREATE TABLE IF NOT EXISTS radar_insight_ads (
  insight_id INTEGER NOT NULL REFERENCES radar_sync_insights(id) ON DELETE CASCADE,
  ad_id INTEGER NOT NULL REFERENCES radar_ads(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_id, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_radar_insight_ads_ad ON radar_insight_ads(ad_id);
`);

// A leitura é gravada logo após a coleta: os anúncios que ela analisou têm
// first_seen dentro da mesma janela da sincronização. Liga até `ads` criativos.
const insights = db
  .prepare("SELECT id, source, ads, created_at FROM radar_sync_insights WHERE ads > 0 ORDER BY id")
  .all();

const candidates = db.prepare(
  `SELECT id FROM radar_ads
   WHERE source = ? AND ABS(julianday(first_seen) - julianday(?)) * 1440 <= 3
   ORDER BY id DESC LIMIT ?`,
);
const link = db.prepare("INSERT OR IGNORE INTO radar_insight_ads (insight_id, ad_id) VALUES (?, ?)");

let linked = 0;
for (const insight of insights) {
  const rows = candidates.all(insight.source, insight.created_at, insight.ads);
  for (const row of rows) {
    link.run(insight.id, row.id);
    linked += 1;
  }
}

const total = db.prepare("SELECT COUNT(*) AS n FROM radar_insight_ads").get().n;
const covered = db.prepare("SELECT COUNT(DISTINCT ad_id) AS n FROM radar_insight_ads").get().n;
console.log(`Vínculos inseridos: ${linked} · total na tabela: ${total} · criativos cobertos: ${covered}`);
