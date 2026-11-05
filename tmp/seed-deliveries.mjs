import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/fluxo.db");

// Só semeia se a tabela ainda estiver vazia para não duplicar em reexecuções.
const existing = db.prepare("SELECT COUNT(*) AS n FROM radar_alert_sends").get().n;
if (existing > 0) {
  console.log(`radar_alert_sends já tem ${existing} linha(s); nada a fazer.`);
  process.exit(0);
}

const now = new Date("2026-11-04T09:30:00Z");
const stamp = (minutesAgo) =>
  new Date(now.getTime() - minutesAgo * 60_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

/** Alerta de fonte + entrega correspondente. */
const demo = [
  {
    kind: "source_down",
    source: "meta",
    detail: "A Meta Ad Library parou de responder (HTTP 502) na sincronização automática.",
    minutesAgo: 1450,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0001" },
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0001" },
    ],
  },
  {
    kind: "source_error_rate",
    source: "tiktok",
    detail: "Taxa de falha de 33,3% nas últimas 6 execuções da fonte TikTok (mínimo 4).",
    minutesAgo: 1180,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0002" },
    ],
  },
  {
    kind: "source_ok",
    source: "meta",
    detail: "A Meta voltou a sincronizar após 4 falha(s) seguida(s).",
    minutesAgo: 1090,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0003" },
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0002" },
    ],
  },
  {
    kind: "source_down",
    source: "bing",
    detail: "A Microsoft Ad Library retornou 429 (limite de requisições) por 3 sincronizações seguidas.",
    minutesAgo: 820,
    sends: [
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0003" },
      {
        channel: "whatsapp",
        destination: "+55 11 97777-3311",
        status: "failed",
        error: "WhatsApp respondeu 401: token expirado",
      },
    ],
  },
  {
    kind: "source_ok",
    source: "bing",
    detail: "O Bing voltou a sincronizar após 3 falha(s) seguida(s).",
    minutesAgo: 640,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0004" },
    ],
  },
  {
    kind: "source_error_rate",
    source: "meta",
    detail: "Taxa de falha de 40,0% nas últimas 10 execuções da fonte Meta (mínimo 4).",
    minutesAgo: 430,
    sends: [
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0004" },
    ],
  },
  {
    kind: "source_ok",
    source: "tiktok",
    detail: "O TikTok voltou a sincronizar após 2 falha(s) seguida(s).",
    minutesAgo: 260,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0005" },
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0005" },
    ],
  },
  {
    kind: "source_down",
    source: "tiktok",
    detail: "O TikTok Creative Center deixou de responder na sincronização das 06:00.",
    minutesAgo: 95,
    sends: [
      { channel: "whatsapp", destination: "+55 11 98888-1240", status: "sent", provider_id: "wamid.DEMO0006" },
      { channel: "email", destination: "operacao@prismaia.com.br", status: "sent", provider_id: "re_demo_0006" },
    ],
  },
];

const insertAlert = db.prepare(
  `INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, source, created_at, read_at)
   VALUES (?, NULL, NULL, ?, ?, ?, NULL)`,
);
const insertSend = db.prepare(
  `INSERT INTO radar_alert_sends (alert_id, channel, destination, status, provider_id, error, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

let alerts = 0;
let sends = 0;

for (const row of demo) {
  const alert = insertAlert.run(row.kind, row.detail, row.source, stamp(row.minutesAgo));
  const alertId = Number(alert.lastInsertRowid);
  alerts += 1;
  for (const [index, send] of row.sends.entries()) {
    insertSend.run(
      alertId,
      send.channel,
      send.destination,
      send.status,
      send.provider_id ?? null,
      send.error ?? null,
      stamp(row.minutesAgo - index * 2),
    );
    sends += 1;
  }
}

console.log(`Semeado: ${alerts} alertas de fonte e ${sends} entregas.`);
