import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/fluxo.db");

const insert = db.prepare(`
  INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, created_at, read_at, source)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const details = [
  "Atacado Bella Moda começou a rodar um anúncio novo em moda-atacado.",
  "Criativo de Boutique Cíntia Reis está sendo copiado por concorrentes.",
  "AutoCenter Prime Veículos entrou no radar de vencedores com score alto.",
  "Garage Motors começou a rodar um anúncio novo em automoveis.",
  "Sushi Kaito começou a rodar um anúncio novo em restaurante.",
  "Lumina Skincare começou a rodar um anúncio novo em ecommerce.",
  "Odonto Sorriso Prime entrou no radar de vencedores com score alto.",
  "Curso Tráfego de Elite começou a rodar um anúncio novo em infoproduto.",
  "Imóveis Horizonte começou a rodar um anúncio novo em imobiliaria.",
  "Clínica Lumière começou a rodar um anúncio novo em estetica.",
];

const sources = ["bing", "meta", "tiktok", "sandbox"];

for (let i = 9; i <= 25; i++) {
  const kind = i % 3 === 0 ? "new_ad" : i % 3 === 1 ? "clone" : "new_winner";
  const detail = details[i - 9] || details[0];
  const source = sources[Math.floor(Math.random() * sources.length)];
  const readAt = i % 4 === 0 ? `2026-11-${i % 28 + 1} 10:00:00` : null;
  
  insert.run(kind, i, null, detail, `2026-11-${i % 28 + 1} 08:00:00`, readAt, source);
}

console.log(`Inseridas ${25 - 8} novas linhas em radar_alerts`);

const count = db.prepare("SELECT COUNT(*) as n FROM radar_alerts").get();
console.log("Total radar_alerts:", count);

const kinds = db.prepare("SELECT kind, COUNT(*) as n FROM radar_alerts GROUP BY kind").all();
console.log("Por kind:", JSON.stringify(kinds, null, 2));
