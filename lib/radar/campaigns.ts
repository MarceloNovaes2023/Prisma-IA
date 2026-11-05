import { nowStamp } from "@/lib/format";
import { radarDb } from "./db";
import { getAd } from "./search";
import type { RadarAd } from "./types";

export type ChecklistItem = { key: string; label: string; done: boolean };

export type Campaign = {
  id: number;
  brief_id: number;
  ad_id: number;
  collection_id: number | null;
  name: string;
  budget: number;
  days: number;
  audience: string;
  checklist: ChecklistItem[];
  created_at: string;
  advertiser: string;
  headline: string | null;
  brief_title: string;
};

type CampaignRow = Omit<Campaign, "checklist"> & { checklist: string };

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function genderLabel(gender: string | null): string {
  if (!gender || gender === "all") return "todos os gêneros";
  if (gender === "female") return "feminino";
  if (gender === "male") return "masculino";
  return gender;
}

/** Público sugerido a partir do que o anúncio original já entrega. */
export function defaultAudience(ad: RadarAd): string {
  const network =
    ad.network === "instagram" ? "Instagram feed e reels" : ad.network === "tiktok" ? "TikTok" : "Facebook feed e stories";
  return `${ad.country} · ${ad.age_min ?? 18}–${ad.age_max ?? 65} anos · ${genderLabel(ad.gender)} · ${network}`;
}

function parseChecklist(raw: string): ChecklistItem[] {
  try {
    const parsed = JSON.parse(raw) as ChecklistItem[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.label === "string").map((item) => ({
          key: String(item.key),
          label: item.label,
          done: Boolean(item.done),
        }))
      : [];
  } catch {
    return [];
  }
}

/** Checklist de execução: o que precisa acontecer entre aprovar o briefing e escalar o criativo. */
function buildChecklist(
  ad: RadarAd,
  input: { budget: number; days: number; audience: string; collectionId: number | null },
): ChecklistItem[] {
  const daily = input.budget / input.days;
  const hook = (ad.headline ?? ad.body).split(/[.!?]/)[0].slice(0, 70);
  return [
    { key: "brief", label: `Briefing aprovado com o time (gancho, oferta e roteiro de 30s)`, done: false },
    { key: "creative", label: `Criativo produzido no gancho "${hook}" e revisado antes de subir`, done: false },
    { key: "audience", label: `Público configurado: ${input.audience}`, done: false },
    {
      key: "budget",
      label: `Orçamento de ${money(input.budget)} em ${input.days} dia(s) — ${money(daily)} por dia, sem escalar antes de 48h`,
      done: false,
    },
    {
      key: "tracking",
      label: input.collectionId
        ? `Origem do lead conferida no link (colecao=${input.collectionId}) e UTM aplicada`
        : "Origem do lead conferida no link (Radar) e UTM aplicada",
      done: false,
    },
    {
      key: "landing",
      label: `Página de destino repete o gancho do anúncio: ${ad.landing_url ?? ad.landing_domain ?? "sem lander"}`,
      done: false,
    },
    { key: "launch", label: "Subir em rascunho, checar entrega em 24h e só então escalar", done: false },
  ];
}

/** Transforma um briefing salvo em campanha com orçamento, público e checklist. */
export function createCampaignFromBrief(input: {
  briefId: number;
  budget: number;
  days: number;
  audience: string;
}): number | null {
  const db = radarDb();
  const brief = db
    .prepare("SELECT id, ad_id, collection_id, title FROM radar_briefs WHERE id = ?")
    .get(input.briefId) as { id: number; ad_id: number; collection_id: number | null; title: string } | undefined;
  if (!brief) return null;

  const ad = getAd(brief.ad_id);
  if (!ad) return null;

  const budget = Math.max(0, Math.round(input.budget * 100) / 100);
  const days = Math.min(90, Math.max(1, Math.round(input.days)));
  const audience = input.audience.trim() || defaultAudience(ad);
  const name = `Campanha · ${brief.title.replace(/^Briefing · /, "")}`;
  const checklist = buildChecklist(ad, { budget, days, audience, collectionId: brief.collection_id });

  const result = db
    .prepare(
      `INSERT INTO radar_campaigns (brief_id, ad_id, collection_id, name, budget, days, audience, checklist, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(brief.id, ad.id, brief.collection_id, name, budget, days, audience, JSON.stringify(checklist), nowStamp());

  return Number(result.lastInsertRowid);
}

export function listCampaigns(): Campaign[] {
  const rows = radarDb()
    .prepare(
      `SELECT c.*, a.advertiser, a.headline, b.title AS brief_title
       FROM radar_campaigns c
       JOIN radar_ads a ON a.id = c.ad_id
       JOIN radar_briefs b ON b.id = c.brief_id
       ORDER BY c.id DESC`,
    )
    .all() as CampaignRow[];
  return rows.map((row) => ({ ...row, checklist: parseChecklist(row.checklist) }));
}

/** Briefings deste anúncio que já viraram campanha. */
export function campaignsForAd(adId: number): { id: number; brief_id: number }[] {
  return radarDb()
    .prepare("SELECT id, brief_id FROM radar_campaigns WHERE ad_id = ? ORDER BY id DESC")
    .all(adId) as { id: number; brief_id: number }[];
}

/** Marca ou desmarca um item do checklist de execução. */
export function toggleCampaignItem(campaignId: number, key: string): void {
  const db = radarDb();
  const row = db.prepare("SELECT checklist FROM radar_campaigns WHERE id = ?").get(campaignId) as
    | { checklist: string }
    | undefined;
  if (!row) return;
  const next = parseChecklist(row.checklist).map((item) =>
    item.key === key ? { ...item, done: !item.done } : item,
  );
  db.prepare("UPDATE radar_campaigns SET checklist = ? WHERE id = ?").run(JSON.stringify(next), campaignId);
}
