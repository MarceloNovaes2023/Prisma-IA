import { radarDb } from "./db";
import { nowStamp } from "@/lib/format";
import type { Collection, RadarAlert, SourceStatus, TrackedBrand } from "./types";

export async function listBrands(): Promise<TrackedBrand[]> {
  const db = await radarDb();
  return (await db.prepare(
    `SELECT b.id, b.name, b.domain, b.note, b.created_at,
            (SELECT COUNT(*) FROM radar_ads a WHERE a.advertiser = b.name) AS ads,
            (SELECT COALESCE(SUM(a.active), 0) FROM radar_ads a WHERE a.advertiser = b.name) AS active,
            (SELECT COALESCE(ROUND(AVG(a.winning_score)), 0) FROM radar_ads a WHERE a.advertiser = b.name) AS avg_score,
            (SELECT MAX(a.start_date) FROM radar_ads a WHERE a.advertiser = b.name) AS last_new
     FROM radar_brands b
     ORDER BY b.id DESC`
  ).all()) as TrackedBrand[];
}

export async function addBrand(name: string, domain: string | null, note: string | null) {
  const db = await radarDb();
  await db.prepare("INSERT OR IGNORE INTO radar_brands (name, domain, note, created_at) VALUES (?, ?, ?, ?)").run(name.trim(), domain?.trim() || null, note?.trim() || null, nowStamp());
}

export async function removeBrand(id: number) {
  const db = await radarDb();
  await db.prepare("DELETE FROM radar_brands WHERE id = ?").run(id);
}

export type AlertRow = RadarAlert & {
  headline: string | null;
  advertiser: string | null;
  score: number | null;
  brand_name: string | null;
};

export async function listAlerts(limit = 60): Promise<AlertRow[]> {
  const db = await radarDb();
  return (await db.prepare(
    `SELECT al.*, a.headline, a.advertiser, a.winning_score AS score, b.name AS brand_name
     FROM radar_alerts al
     LEFT JOIN radar_ads a ON a.id = al.ad_id
     LEFT JOIN radar_brands b ON b.id = al.brand_id
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ?`
  ).all(limit)) as AlertRow[];
}

export async function unreadAlerts(): Promise<number> {
  const db = await radarDb();
  const row = await db.prepare("SELECT COUNT(*) AS n FROM radar_alerts WHERE read_at IS NULL").first() as { n: number } | null;
  return row?.n ?? 0;
}

export async function markAlertsRead() {
  const db = await radarDb();
  await db.prepare("UPDATE radar_alerts SET read_at = ? WHERE read_at IS NULL").run(nowStamp());
}

export async function insertAlert(
  kind: string,
  adId: number | null,
  brandId: number | null,
  detail: string,
  source: string | null = null,
) {
  const db = await radarDb();
  await db.prepare("INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, source, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(kind, adId, brandId, detail, source, nowStamp());
}

export async function listCollections(): Promise<Collection[]> {
  const db = await radarDb();
  return (await db.prepare(
    `SELECT c.id, c.name, c.color, c.created_at,
            (SELECT COUNT(*) FROM radar_collection_items ci WHERE ci.collection_id = c.id) AS items
     FROM radar_collections c ORDER BY c.id ASC`
  ).all()) as Collection[];
}

export async function createCollection(name: string, color = "#a3f04b") {
  const db = await radarDb();
  const result = await db.prepare("INSERT INTO radar_collections (name, color, created_at) VALUES (?, ?, ?)").run(name.trim(), color, nowStamp());
  return Number(result.lastInsertRowId);
}

export async function addToCollection(collectionId: number, adId: number) {
  const db = await radarDb();
  await db.prepare("INSERT OR IGNORE INTO radar_collection_items (collection_id, ad_id, created_at) VALUES (?, ?, ?)").run(collectionId, adId, nowStamp());
}

export async function removeFromCollection(collectionId: number, adId: number) {
  const db = await radarDb();
  await db.prepare("DELETE FROM radar_collection_items WHERE collection_id = ? AND ad_id = ?").run(collectionId, adId);
}

export async function collectionsForAd(adId: number): Promise<number[]> {
  const db = await radarDb();
  const rows = await db.prepare("SELECT collection_id FROM radar_collection_items WHERE ad_id = ?").all(adId) as { collection_id: number }[];
  return rows.map((row) => row.collection_id);
}

export async function listSaved() {
  const db = await radarDb();
  return (await db.prepare("SELECT id, name, query, created_at FROM radar_saved ORDER BY id DESC").all()) as {
    id: number;
    name: string;
    query: string;
    created_at: string;
  }[];
}

export async function saveSearch(name: string, query: string) {
  const db = await radarDb();
  await db.prepare("INSERT INTO radar_saved (name, query, created_at) VALUES (?, ?, ?)").run(name.trim(), query, nowStamp());
}

export async function deleteSaved(id: number) {
  const db = await radarDb();
  await db.prepare("DELETE FROM radar_saved WHERE id = ?").run(id);
}

type SyncRow = {
  status: string;
  fetched: number;
  inserted: number;
  updated: number;
  message: string | null;
  finished_at: string | null;
  duration_ms: number | null;
};

export async function lastSync(source: string): Promise<SyncRow | null> {
  const db = await radarDb();
  const row = await db.prepare(
    "SELECT status, fetched, inserted, updated, message, finished_at, duration_ms FROM radar_syncs WHERE source = ? ORDER BY id DESC LIMIT 1",
  ).first(source) as SyncRow | undefined;
  return row ?? null;
}

export async function syncHistory(limit = 12) {
  const db = await radarDb();
  return (await db.prepare(
    "SELECT id, source, status, fetched, inserted, updated, message, started_at, finished_at, duration_ms FROM radar_syncs ORDER BY id DESC LIMIT ?",
  ).all(limit)) as {
    id: number;
    source: string;
    status: string;
    fetched: number;
    inserted: number;
    updated: number;
    message: string | null;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
  }[];
}

export function sourceStatuses(): SourceStatus[] {
  const metaToken = process.env.META_AD_LIBRARY_TOKEN?.trim();
  const tiktokKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const tiktokSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();

  return [
    {
      source: "meta",
      label: "Meta Ad Library API",
      mode: metaToken ? "live" : "sandbox",
      coverage: "Comercial: UE + Reino Unido · Político: global (inclui Brasil)",
      detail: "API oficial graph.facebook.com/v26.0/ads_archive. Exige verificação de identidade no Meta for Developers.",
      configured: Boolean(metaToken),
      last: undefined,
    },
    {
      source: "tiktok",
      label: "TikTok Commercial Content API",
      mode: tiktokKey && tiktokSecret ? "live" : "sandbox",
      coverage: "Comercial: União Europeia (últimos 12 meses)",
      detail: "Endpoint open.tiktokapis.com/v2/research/adlib/ad/query/, 10 resultados por página. Requer aprovação como cliente de pesquisa. Cobertura exclusiva da UE.",
      configured: Boolean(tiktokKey && tiktokSecret),
      last: undefined,
    },
    {
      source: "bing",
      label: "Microsoft Ad Library API",
      mode: "live",
      coverage: "Comercial: Espaço Econômico Europeu (1 a 3 dias de atraso)",
      detail: "API oficial adlibrary.api.bingads.microsoft.com/api/v1/Ads, aberta a terceiros sem token. Entra sozinha no ciclo automático; desligue com RADAR_BING_ENABLED=off.",
      configured: true,
      last: undefined,
    },
    {
      source: "import",
      label: "Importação própria",
      mode: "import",
      coverage: "Qualquer país — o que você licenciar ou coletar",
      detail: "Cole JSON no padrão do Radar (ou envie um array de anúncios pelo endpoint de importação). É o caminho para base brasileira sem depender de API que não existe.",
      configured: true,
      last: undefined,
    },
    {
      source: "sandbox",
      label: "Base de demonstração",
      mode: "sandbox",
      coverage: "Dados sintéticos, 30 marcas, 11 nichos",
      detail: "Anúncios gerados localmente para você operar o produto inteiro sem chave. Marcados com a origem sandbox — nunca se misturam com dado real na interface.",
      configured: true,
      last: undefined,
    },
  ];
}
