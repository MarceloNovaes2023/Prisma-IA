const s = JSON.parse(require('fs').readFileSync('tmp/kraken-app-schema.json', 'utf8'));
const tables = [...new Set(
  [...s.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(x => x[1])
)];
const idxCount = s.split('CREATE INDEX').length - 1;
console.log('tabelas:', tables);
console.log('indices:', idxCount);
console.log('bytes:', Buffer.byteLength(s, 'utf8'));
console.log('has payments.code unique:', s.includes('code TEXT NOT NULL UNIQUE'));
console.log('has radar_assets:', s.includes('radar_ads'));
