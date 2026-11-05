import { getDb } from "@/lib/db";
import { nowStamp } from "@/lib/format";
import { ingestLead } from "@/lib/ingest";
import { radarDb } from "./db";
import { getAd } from "./search";

export type SavedBrief = {
  id: number;
  ad_id: number;
  collection_id: number | null;
  title: string;
  text: string;
  model: string;
  simulated: number;
  created_at: string;
  advertiser: string;
  headline: string | null;
};

const BRIEF_COLUMNS = `b.id, b.ad_id, b.collection_id, b.title, b.text, b.model, b.simulated, b.created_at,
       a.advertiser, a.headline`;

/** Guarda o briefing como artefato da campanha, ligado ao anúncio e (opcionalmente) à prancha. */
export function saveBrief(input: {
  adId: number;
  collectionId?: number | null;
  text: string;
  model: string;
  simulated: boolean;
}): number | null {
  const ad = getAd(input.adId);
  const text = input.text.trim();
  if (!ad || !text) return null;

  const title = ad.headline
    ? `Briefing · ${ad.advertiser} — ${ad.headline.slice(0, 70)}`
    : `Briefing · ${ad.advertiser}`;

  const result = radarDb()
    .prepare(
      `INSERT INTO radar_briefs (ad_id, collection_id, title, text, model, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ad.id, input.collectionId ?? null, title, text, input.model || "local", input.simulated ? 1 : 0, nowStamp());

  return Number(result.lastInsertRowid);
}

export function listBriefs(adId: number, limit = 6): SavedBrief[] {
  return radarDb()
    .prepare(
      `SELECT ${BRIEF_COLUMNS} FROM radar_briefs b
       JOIN radar_ads a ON a.id = b.ad_id
       WHERE b.ad_id = ? ORDER BY b.id DESC LIMIT ?`,
    )
    .all(adId, limit) as SavedBrief[];
}

export function briefsForCollection(collectionId: number, limit = 5): SavedBrief[] {
  return radarDb()
    .prepare(
      `SELECT ${BRIEF_COLUMNS} FROM radar_briefs b
       JOIN radar_ads a ON a.id = b.ad_id
       WHERE b.collection_id = ? ORDER BY b.id DESC LIMIT ?`,
    )
    .all(collectionId, limit) as SavedBrief[];
}

/** Etapas em que o lead já virou dinheiro — as mesmas usadas nos relatórios do funil. */
const WON_STAGES = "'fechado','entregue','vendido','ativo','onboarding','recompra','retorno'";

/** Quantos leads nasceram de cada prancha. */
export function leadsFromBoard(collectionId: number): number {
  const row = radarDb()
    .prepare("SELECT COUNT(*) AS n FROM radar_lead_origins WHERE collection_id = ?")
    .get(collectionId) as { n: number };
  return row.n;
}

export type BoardRevenue = {
  collection_id: number;
  name: string;
  color: string;
  items: number;
  leads: number;
  won: number;
  revenue: number;
  conversion: number;
  ticket: number;
};

/**
 * Receita por prancha: cruza os leads originados em cada coleção
 * (`radar_lead_origins`) com o estágio e o valor que eles alcançaram no funil.
 * Ordenado pela prancha que mais faturou.
 */
export function boardRevenue(): BoardRevenue[] {
  const rows = radarDb()
    .prepare(
      `SELECT c.id AS collection_id, c.name, c.color,
              (SELECT COUNT(*) FROM radar_collection_items i WHERE i.collection_id = c.id) AS items,
              COUNT(o.lead_id) AS leads,
              COALESCE(SUM(CASE WHEN l.stage IN (${WON_STAGES}) THEN 1 ELSE 0 END), 0) AS won,
              COALESCE(SUM(CASE WHEN l.stage IN (${WON_STAGES}) THEN COALESCE(l.value, 0) ELSE 0 END), 0) AS revenue
       FROM radar_collections c
       LEFT JOIN radar_lead_origins o ON o.collection_id = c.id
       LEFT JOIN leads l ON l.id = o.lead_id
       GROUP BY c.id
       ORDER BY revenue DESC, won DESC, leads DESC, c.id ASC`,
    )
    .all() as Omit<BoardRevenue, "conversion" | "ticket">[];

  return rows.map((row) => ({
    ...row,
    conversion: row.leads === 0 ? 0 : (row.won / row.leads) * 100,
    ticket: row.won === 0 ? 0 : row.revenue / row.won,
  }));
}

export type BoardLeadResult =
  | { ok: true; leadId: number; created: boolean; score: number }
  | { ok: false; error: string };

/**
 * Cria o lead reaproveitando o ingest do funil (score, dedupe por telefone, cadência),
 * e registra de qual anúncio/prancha ele veio — sem duplicar a lógica de lead.
 */
export function createLeadFromBoard(input: {
  adId: number;
  collectionId: number;
  name: string;
  phone: string;
  vertical: string;
  city?: string;
}): BoardLeadResult {
  const db = radarDb();
  const ad = getAd(input.adId);
  if (!ad) return { ok: false, error: "anúncio não encontrado" };

  const board = db
    .prepare("SELECT name FROM radar_collections WHERE id = ?")
    .get(input.collectionId) as { name: string } | undefined;
  if (!board) return { ok: false, error: "coleção não encontrada" };

  const member = db
    .prepare("SELECT 1 AS ok FROM radar_collection_items WHERE collection_id = ? AND ad_id = ?")
    .get(input.collectionId, input.adId);
  if (!member) return { ok: false, error: "este anúncio não está na prancha" };

  const name = input.name.trim();
  if (!name || !input.phone.trim()) return { ok: false, error: "nome e WhatsApp são obrigatórios" };

  const result = ingestLead({
    name,
    phone: input.phone,
    vertical: input.vertical,
    source: `Radar · ${board.name}`,
    city: input.city?.trim() || undefined,
  });

  db.prepare(
    "INSERT OR IGNORE INTO radar_lead_origins (lead_id, ad_id, collection_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(result.id, ad.id, input.collectionId, nowStamp());

  getDb()
    .prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'radar.lead', ?, ?)")
    .run(
      result.id,
      result.created
        ? `Lead criado da prancha "${board.name}" — criativo de ${ad.advertiser} (${ad.external_id})`
        : `Lead reconhecido na prancha "${board.name}" (telefone já estava na base) — criativo de ${ad.advertiser}`,
      nowStamp(),
    );

  return { ok: true, leadId: result.id, created: result.created, score: result.score };
}

export type LeadOrigin = { lead_id: number; ad_id: number; collection_id: number | null; created_at: string };

export function leadOriginsForAd(adId: number): LeadOrigin[] {
  return radarDb()
    .prepare("SELECT lead_id, ad_id, collection_id, created_at FROM radar_lead_origins WHERE ad_id = ? ORDER BY created_at DESC")
    .all(adId) as LeadOrigin[];
}
