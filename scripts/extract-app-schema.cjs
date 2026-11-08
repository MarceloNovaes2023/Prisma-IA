const s = require('fs').readFileSync('lib/db.ts', 'utf8');
const m = s.match(/^const SCHEMA = `([^`]*)`;/ms);
if (!m) { console.error('SCHEMA nao achado'); process.exit(1); }
const schema = m[1].trim();
if (!schema.includes('CREATE TABLE') && !schema.includes('CREATE INDEX')) {
  console.error('SCHEMA sem DDL');
  process.exit(1);
}
console.log(JSON.stringify(schema));
