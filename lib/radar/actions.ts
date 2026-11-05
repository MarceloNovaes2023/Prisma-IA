"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBrief, type Brief } from "./brief";
import { createCampaignFromBrief, toggleCampaignItem } from "./campaigns";
import { deliverSourceAlerts, type AlertChannel } from "./notices";
import { createLeadFromBoard, saveBrief } from "./funnel";
import { getAd } from "./search";
import { runSyncLeased } from "./sync-alerts";
import {
  addBrand,
  addToCollection,
  createCollection,
  deleteSaved,
  markAlertsRead,
  removeBrand,
  removeFromCollection,
  saveSearch,
} from "./track";

function refresh() {
  revalidatePath("/radar");
  revalidatePath("/radar/tendencias");
  revalidatePath("/radar/marcas");
  revalidatePath("/radar/alertas");
  revalidatePath("/radar/colecoes");
  revalidatePath("/radar/campanhas");
  revalidatePath("/radar/fontes");
  revalidatePath("/inbox");
  revalidatePath("/leads");
  revalidatePath("/funil");
}

export async function trackBrandAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  addBrand(name, String(formData.get("domain") ?? ""), String(formData.get("note") ?? ""));
  refresh();
  redirect("/radar/marcas?ok=marca");
}

export async function untrackBrandAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (Number.isFinite(id) && id > 0) removeBrand(id);
  refresh();
  redirect("/radar/marcas?ok=removida");
}

export async function createCollectionAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const color = String(formData.get("color") ?? "#a3f04b");
  createCollection(name, color);
  refresh();
  redirect("/radar/colecoes?ok=colecao");
}

export async function addToCollectionAction(formData: FormData) {
  const collectionId = Number(formData.get("collectionId"));
  const adId = Number(formData.get("adId"));
  if (Number.isFinite(collectionId) && collectionId > 0 && Number.isFinite(adId) && adId > 0) {
    addToCollection(collectionId, adId);
  }
  refresh();
  revalidatePath(`/radar/anuncio/${adId}`);
  redirect(String(formData.get("back") ?? `/radar/anuncio/${adId}`));
}

export async function removeFromCollectionAction(formData: FormData) {
  const collectionId = Number(formData.get("collectionId"));
  const adId = Number(formData.get("adId"));
  if (Number.isFinite(collectionId) && Number.isFinite(adId)) removeFromCollection(collectionId, adId);
  refresh();
  revalidatePath(`/radar/anuncio/${adId}`);
  redirect(String(formData.get("back") ?? "/radar/colecoes"));
}

export async function markAlertsReadAction() {
  markAlertsRead();
  refresh();
  redirect("/radar/alertas");
}

export async function saveSearchAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  if (name && query) saveSearch(name, query);
  refresh();
  redirect("/radar?salvo=1");
}

export async function deleteSavedAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) deleteSaved(id);
  refresh();
  redirect("/radar");
}

export async function syncAction(formData: FormData) {
  const source = String(formData.get("source") ?? "sandbox");
  const searchTerms = String(formData.get("searchTerms") ?? "").trim() || undefined;
  const countries = String(formData.get("countries") ?? "").trim() || undefined;
  const json = String(formData.get("json") ?? "").trim() || undefined;

  // mesma trava do agendador: nunca coleta duas vezes em paralelo, e avisa quando está ocupado
  const outcome = await runSyncLeased(source, { searchTerms, countries, json });
  refresh();
  if (outcome.busy) {
    redirect(
      `/radar/fontes?${new URLSearchParams({ feito: "ocupado", fonte: source, msg: outcome.message }).toString()}`,
    );
  }
  const { result } = outcome;
  const params = new URLSearchParams({
    feito: result.status,
    fonte: source,
    inseridos: String(result.inserted),
    atualizados: String(result.updated),
    ms: String(result.durationMs),
    msg: result.message.slice(0, 220),
  });
  redirect(`/radar/fontes?${params.toString()}`);
}

export async function saveBriefAction(formData: FormData) {
  const adId = Number(formData.get("adId"));
  const text = String(formData.get("text") ?? "");
  const collectionId = Number(formData.get("collectionId") ?? 0) || null;
  if (!Number.isFinite(adId) || adId <= 0 || !text.trim()) return;

  saveBrief({
    adId,
    collectionId,
    text,
    model: String(formData.get("model") ?? "local"),
    simulated: String(formData.get("simulated") ?? "0") === "1",
  });

  refresh();
  revalidatePath(`/radar/anuncio/${adId}`);
  redirect(`/radar/anuncio/${adId}?brief=salvo`);
}

/** Envia, a partir do painel, os alertas de fonte fora do ar e de recuperação. */
export async function sendSourceAlertsAction(formData: FormData) {
  const channel = String(formData.get("channel") ?? "") as AlertChannel;
  const to = String(formData.get("to") ?? "");

  const result = await deliverSourceAlerts({ channel, to });

  refresh();
  const params = new URLSearchParams({
    envio: result.channel,
    estado: result.ok ? (result.sent > 0 ? "ok" : "vazio") : "erro",
    qtd: String(result.sent),
    msg: result.message.slice(0, 180),
  });
  redirect(`/radar/alertas?${params.toString()}`);
}

/** Transforma um briefing salvo em campanha com orçamento, público e checklist de execução. */
export async function createCampaignFromBriefAction(formData: FormData) {
  const briefId = Number(formData.get("briefId"));
  if (!Number.isFinite(briefId) || briefId <= 0) return;

  const budget = Number(String(formData.get("budget") ?? "0").replace(",", "."));
  const days = Number(formData.get("days"));

  const id = createCampaignFromBrief({
    briefId,
    budget: Number.isFinite(budget) ? budget : 0,
    days: Number.isFinite(days) && days > 0 ? days : 7,
    audience: String(formData.get("audience") ?? ""),
  });

  refresh();
  revalidatePath("/radar/campanhas");
  redirect(id ? "/radar/campanhas?ok=campanha" : "/radar/campanhas?erro=briefing");
}

/** Marca/desmarca um item do checklist de execução da campanha. */
export async function toggleCampaignItemAction(formData: FormData) {
  const campaignId = Number(formData.get("campaignId"));
  const key = String(formData.get("key") ?? "");
  if (!Number.isFinite(campaignId) || campaignId <= 0 || !key) return;
  toggleCampaignItem(campaignId, key);
  revalidatePath("/radar/campanhas");
}

/** Cria um lead a partir de um criativo salvo na prancha, mantendo o rastro do anúncio. */
export async function createLeadFromBoardAction(formData: FormData) {
  const adId = Number(formData.get("adId"));
  const collectionId = Number(formData.get("collectionId"));
  if (!Number.isFinite(adId) || !Number.isFinite(collectionId)) {
    redirect("/radar/colecoes?erro=dados-invalidos");
  }

  const result = createLeadFromBoard({
    adId,
    collectionId,
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    vertical: String(formData.get("vertical") ?? ""),
    city: String(formData.get("city") ?? ""),
  });

  refresh();
  if (!result.ok) {
    redirect(`/radar/colecoes?erro=${encodeURIComponent(result.error)}`);
  }
  redirect(`/inbox?lead=${result.leadId}`);
}

export type BriefState = Brief & { adId: number; error?: string };

export async function generateBriefAction(_state: BriefState | null, formData: FormData): Promise<BriefState | null> {
  const adId = Number(formData.get("adId"));
  if (!Number.isFinite(adId)) return null;
  const ad = getAd(adId);
  if (!ad) return null;
  const brief = await createBrief(ad);
  return { ...brief, adId };
}
