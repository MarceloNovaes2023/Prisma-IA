import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/fluxo.db");
// Check radar_alerts
try {
  const schema = db.prepare("PRAGMA table_info(radar_alerts)");
  console.log("radar_alerts schema:", schema.toString());
} catch(e) { console.error("No radar_alerts table:", e.message); }
// Count rows
try {
  const count = db.prepare("SELECT COUNT(*) as n FROM radar_alerts").get();
  console.log("radar_alerts count:", count);
} catch(e) { console.error("Error counting:", e.message); }
// Sample rows
try {
  const rows = db.prepare("SELECT * FROM radar_alerts LIMIT 5").all();
  console.log("radar_alerts sample:", JSON.stringify(rows, null, 2));
} catch(e) { console.error("Error reading:", e.message); }
// Check radar_syncs
try {
  const syncCount = db.prepare("SELECT COUNT(*) as n FROM radar_syncs").get();
  console.log("radar_syncs count:", syncCount);
  const syncRows = db.prepare("SELECT * FROM radar_syncs LIMIT 3").all();
  console.log("radar_syncs sample:", JSON.stringify(syncRows, null, 2));
} catch(e) { console.error("Error:", e.message); }
