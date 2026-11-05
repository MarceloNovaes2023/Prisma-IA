import Database from "node:sqlite";
const db = new Database.Database("data/fluxo.db");
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
});
db.close();
