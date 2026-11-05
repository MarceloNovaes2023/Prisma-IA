import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/fluxo.db");
// List tables
const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
console.log("Tables:", tables.toString());
// Check radar_alerts structure
const schema = db.exec("PRAGMA table_info(radar_alerts)");
console.log("radar_alerts schema:", schema.toString());
// Count rows
const count = db.prepare("SELECT COUNT(*) as n FROM radar_alerts").get();
console.log("radar_alerts count:", count);
// Sample rows
const rows = db.prepare("SELECT * FROM radar_alerts LIMIT 5").all();
console.log("radar_alerts sample:", JSON.stringify(rows, null, 2));
