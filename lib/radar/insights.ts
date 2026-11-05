import { callModel, getAiConfig } from "@/lib/ai";
import { nowStamp } from "@/lib/format";
import { radarDb } from "./db";
import { sourceLabel } from "./error-rate";

export type SyncInsight = {
  id: number;
  source: string;
  ads: number;
  model: string;
  simulated: number;
  text: string;
  created_at: string;
};

/** Leitura por IA ligada? `RADAR_INSIGHTS=off` desliga e deixa só a coleta. */
export function insightsEnabled(): boolean {
  const raw = process.env.RADAR_INSIGHTS?.trim().toLowerCase();
  return raw !== "off" && raw !== "0" && raw !== "false";
}

/** Quantos anúncios entram no contexto enviado ao modelo. */
function contextSize(): number {
  const value = Number(process.env.RADAR_INSIGHTS_ADS ?? 6);
  return Number.isFinite(value) && value > 0 ? Math.min(12, Math.round(value)) : 6;
}

type AdRow = { id: number; advertiser: string; headline: string | null; body: string; landing_domain: string | null };

function recentAds(source: string, limit: number): AdRow[] {
  return radarDb()
    .prepare(
      `SELECT id, advertiser, headline, body, landing_domain
       FROM radar_ads WHERE source = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(source, limit) as AdRow[];
}

function excerpt(value: string, max = 160): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Resumo determinístico — mantém o painel informativo quando não há chave de IA. */
function localSummary(source: string, inserted: number, updated: number, ads: AdRow[]): string {
  const label = sourceLabel(source);
  const advertisers = [...new Set(ads.map((ad) => ad.advertiser))].slice(0, 3);
  const domains = [...new Set(ads.map((ad) => ad.landing_domain).filter(Boolean))].slice(0, 3);
  const parts = [
    `${label}: ${inserted} anúncio(s) novo(s)${updated > 0 ? ` e ${updated} atualizado(s)` : ""} nesta sincronização.`,
    advertisers.length > 0 ? `Quem entrou: ${advertisers.join(", ")}.` : null,
    domains.length > 0 ? `Destinos observados: ${domains.join(", ")}.` : null,
    "Resumo automático sem chave de IA — configure AI_API_KEY para a leitura interpretativa.",
  ];
  return parts.filter(Boolean).join(" ");
}

function buildMessages(source: string, inserted: number, updated: number, ads: AdRow[]) {
  const list = ads
    .map((ad, index) => {
      const headline = ad.headline ? ` | título: ${excerpt(ad.headline, 90)}` : "";
      return `${index + 1}. ${ad.advertiser}${headline} | texto: ${excerpt(ad.body)}`;
    })
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "Você é analista de mídia paga de uma operação comercial brasileira. Leia os anúncios coletados e responda em português do Brasil, em no máximo 3 frases curtas: o que está sendo ofertado, qual ângulo/gancho predomina e uma recomendação prática de teste. Não invente números nem dados que não estejam no texto.",
    },
    {
      role: "user" as const,
      content: `Fonte: ${sourceLabel(source)}\nNovos: ${inserted} · atualizados: ${updated}\nAnúncios:\n${list || "(sem anúncios no contexto)"}`,
    },
  ];
}

function insertInsight(
  source: string,
  ads: number,
  model: string,
  simulated: boolean,
  text: string,
  adIds: number[] = [],
): SyncInsight {
  const db = radarDb();
  const info = db
    .prepare(
      "INSERT INTO radar_sync_insights (source, ads, model, simulated, text, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(source, ads, model, simulated ? 1 : 0, text, nowStamp());
  const insightId = Number(info.lastInsertRowid);

  // Liga a leitura ao criativo de origem: cada anúncio analisado guarda o
  // vínculo com a leitura, para o Radar exibir o selo no card e o texto no detalhe.
  if (adIds.length > 0) {
    const link = db.prepare("INSERT OR IGNORE INTO radar_insight_ads (insight_id, ad_id) VALUES (?, ?)");
    for (const adId of adIds) link.run(insightId, adId);
  }

  return db.prepare("SELECT * FROM radar_sync_insights WHERE id = ?").get(insightId) as SyncInsight;
}

/** Última leitura de IA ligada a um criativo (usada no selo e no detalhe do anúncio). */
export function insightForAd(adId: number): SyncInsight | null {
  const row = radarDb()
    .prepare(
      `SELECT i.* FROM radar_sync_insights i
       INNER JOIN radar_insight_ads ia ON ia.insight_id = i.id
       WHERE ia.ad_id = ?
       ORDER BY i.id DESC LIMIT 1`,
    )
    .get(adId) as SyncInsight | undefined;
  return row ?? null;
}

/**
 * Gera a leitura da IA para o que acabou de entrar na base. Chamada junto de
 * cada sincronização (agendador, botão e endpoint). Sem chave configurada, ou
 * se o provedor falhar, grava o resumo local marcado como simulação.
 */
export async function recordSyncInsight(input: {
  source: string;
  inserted: number;
  updated: number;
}): Promise<SyncInsight | null> {
  if (!insightsEnabled()) return null;
  if (input.inserted <= 0 && input.updated <= 0) return null;

  const ads = recentAds(input.source, contextSize());
  // Os anúncios recém-inseridos são os de maior id: só eles recebem o vínculo
  // com a leitura, para o selo aparecer apenas nos criativos novos.
  const analyzed = ads.slice(0, Math.min(Math.max(input.inserted, 0), ads.length)).map((ad) => ad.id);
  const config = getAiConfig();

  if (!config.configured) {
    return insertInsight(
      input.source,
      input.inserted,
      "simulador local",
      true,
      localSummary(input.source, input.inserted, input.updated, ads),
      analyzed,
    );
  }

  const { text, error } = await callModel(buildMessages(input.source, input.inserted, input.updated, ads), config);
  const answer = text.trim().slice(0, 900);
  if (!answer) {
    const fallback = localSummary(input.source, input.inserted, input.updated, ads);
    return insertInsight(
      input.source,
      input.inserted,
      "simulador local",
      true,
      error ? `${fallback} (falha do provedor: ${error.slice(0, 120)})` : fallback,
      analyzed,
    );
  }

  return insertInsight(input.source, input.inserted, config.model, false, answer, analyzed);
}

export function latestInsights(limit = 6, source?: string): SyncInsight[] {
  const db = radarDb();
  return source
    ? (db
        .prepare("SELECT * FROM radar_sync_insights WHERE source = ? ORDER BY id DESC LIMIT ?")
        .all(source, limit) as SyncInsight[])
    : (db.prepare("SELECT * FROM radar_sync_insights ORDER BY id DESC LIMIT ?").all(limit) as SyncInsight[]);
}
