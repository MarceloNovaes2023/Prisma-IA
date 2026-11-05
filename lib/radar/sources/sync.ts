import { nowStamp } from "@/lib/format";
import { radarDb } from "../db";
import { insertAlert } from "../track";
import type { IncomingAd } from "./upsert";
import { recordSync, upsertAds } from "./upsert";
import { dateOnly } from "../score";
import { fetchMetaAds, metaConfigured } from "./meta";
import { fetchBingAds, bingConfigured } from "./bing";
import { fetchTikTokAds, tiktokConfigured } from "./tiktok";
import { normalizeImport } from "./import";

export type SyncResult = {
  source: string;
  status: "ok" | "skipped" | "error";
  fetched: number;
  inserted: number;
  updated: number;
  message: string;
  durationMs: number;
};

export type SyncOptions = {
  searchTerms?: string;
  countries?: string;
  pages?: number;
  json?: string;
  ads?: IncomingAd[];
};

/** Cria dois anúncios novos a partir dos melhores criativos — só para a base de demonstração respirar. */
function sandboxRefresh(): { ads: IncomingAd[]; message: string } {
  const db = radarDb();
  const top = db
    .prepare(
      `SELECT advertiser, network, country, language, landing_url, landing_domain, landing_title, tech_stack,
              cta, media_type, offer_id, affiliate_network, headline, body, gender, age_min, age_max
       FROM radar_ads ORDER BY winning_score DESC, likes DESC LIMIT 4`,
    )
    .all() as {
    advertiser: string;
    network: string;
    country: string;
    language: string;
    landing_url: string | null;
    landing_domain: string | null;
    landing_title: string | null;
    tech_stack: string | null;
    cta: string | null;
    media_type: string;
    offer_id: string | null;
    affiliate_network: string | null;
    headline: string | null;
    body: string;
    gender: string | null;
    age_min: number | null;
    age_max: number | null;
  }[];

  const today = dateOnly(0);
  const ads: IncomingAd[] = top.slice(0, 2).map((ad, index) => ({
    external_id: `sbx_new_${Date.now()}_${index}`,
    source: "sandbox",
    advertiser: ad.advertiser,
    network: ad.network,
    start_date: today,
    country: ad.country,
    language: ad.language,
    gender: ad.gender,
    age_min: ad.age_min,
    age_max: ad.age_max,
    media_type: ad.media_type,
    cta: ad.cta,
    headline: ad.headline ? `${ad.headline.split("·")[0].trim()} — nova versão` : null,
    body: `${ad.body}\n\nNova versão do criativo entrou no ar hoje.`,
    landing_url: ad.landing_url,
    landing_title: ad.landing_title,
    tech_stack: ad.tech_stack,
    offer_id: ad.offer_id,
    affiliate_network: ad.affiliate_network,
    likes: 0,
  }));

  // atualiza a marca de "visto agora" dos ativos
  db.prepare("UPDATE radar_ads SET last_seen = ? WHERE active = 1").run(nowStamp());

  return { ads, message: "Atualização da base de demonstração" };
}

export async function runSync(source: string, options: SyncOptions = {}): Promise<SyncResult> {
  const db = radarDb();
  const started = performance.now();

  const finish = (result: Omit<SyncResult, "durationMs">, durationMs: number) => ({
    ...result,
    durationMs: Math.round(durationMs),
  });

  try {
    let incoming: IncomingAd[] = [];
    let fetched = 0;
    let note = "";

    if (source === "meta") {
      if (!metaConfigured()) {
        const durationMs = performance.now() - started;
        const message = "Configure META_AD_LIBRARY_TOKEN para puxar a Ad Library oficial.";
        recordSync(db, "meta", "skipped", { fetched: 0, inserted: 0, updated: 0, message, durationMs });
        return finish({ source, status: "skipped", fetched: 0, inserted: 0, updated: 0, message }, durationMs);
      }
      incoming = await fetchMetaAds({
        searchTerms: options.searchTerms,
        countries: options.countries,
        pages: options.pages,
      });
      fetched = incoming.length;
      note = `Meta Ad Library · países ${options.countries ?? process.env.META_AD_LIBRARY_COUNTRIES ?? "PT,IE,ES,DE,FR"}`;
    } else if (source === "tiktok") {
      if (!tiktokConfigured()) {
        const durationMs = performance.now() - started;
        const message = "Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (aprovação de pesquisa) para puxar o TikTok.";
        recordSync(db, "tiktok", "skipped", { fetched: 0, inserted: 0, updated: 0, message, durationMs });
        return finish({ source, status: "skipped", fetched: 0, inserted: 0, updated: 0, message }, durationMs);
      }
      const countries = options.countries
        ? options.countries.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean)
        : undefined;
      incoming = await fetchTikTokAds({ searchTerm: options.searchTerms, countries });
      fetched = incoming.length;
      note = "TikTok Commercial Content (UE)";
    } else if (source === "bing") {
      if (!bingConfigured()) {
        const durationMs = performance.now() - started;
        const message = "Fonte Microsoft desligada em RADAR_BING_ENABLED.";
        recordSync(db, "bing", "skipped", { fetched: 0, inserted: 0, updated: 0, message, durationMs });
        return finish({ source, status: "skipped", fetched: 0, inserted: 0, updated: 0, message }, durationMs);
      }
      incoming = await fetchBingAds({ pages: options.pages });
      fetched = incoming.length;
      note = "Microsoft Ad Library (Espaço Econômico Europeu)";
    } else if (source === "import") {
      if (options.ads?.length) {
        incoming = options.ads;
        fetched = incoming.length;
        note = "Importação direta";
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(options.json ?? "");
        } catch {
          throw new Error("JSON inválido. Cole um array de anúncios.");
        }
        const { ads, errors } = normalizeImport(parsed, "import");
        if (ads.length === 0) throw new Error(errors[0] ?? "Nenhum anúncio válido no JSON.");
        incoming = ads;
        fetched = ads.length;
        note = errors.length ? `Importação com ${errors.length} registro(s) ignorado(s)` : "Importação concluída";
      }
    } else if (source === "sandbox") {
      const refreshed = sandboxRefresh();
      incoming = refreshed.ads;
      fetched = incoming.length;
      note = refreshed.message;
    } else {
      throw new Error(`Fonte desconhecida: ${source}`);
    }

    const { inserted, updated } = upsertAds(db, incoming, source);

    // anúncio cuja janela de entrega terminou não pode continuar contando como ativo
    const closed =
      source === "meta"
        ? db
            .prepare("UPDATE radar_ads SET active = 0 WHERE source = 'meta' AND active = 1 AND stop_date IS NOT NULL AND stop_date < ?")
            .run(dateOnly(0)).changes
        : 0;
    if (source === "sandbox" && inserted > 0) {
      const newest = db.prepare("SELECT id, advertiser FROM radar_ads ORDER BY id DESC LIMIT 1").get() as {
        id: number;
        advertiser: string;
      };
      insertAlert("new_ad", newest.id, null, `${newest.advertiser} entrou com criativo novo na base de demonstração.`);
    }

    const durationMs = performance.now() - started;
    const message = `${note} · ${fetched} recebidos, ${inserted} novos, ${updated} atualizados${closed > 0 ? `, ${closed} encerrados` : ""}`;
    recordSync(db, source, "ok", { fetched, inserted, updated, message, durationMs });
    return finish({ source, status: "ok", fetched, inserted, updated, message }, durationMs);
  } catch (error) {
    const durationMs = performance.now() - started;
    const message = error instanceof Error ? error.message : "Falha desconhecida na sincronização";
    recordSync(db, source, "error", { fetched: 0, inserted: 0, updated: 0, message, durationMs });
    return finish({ source, status: "error", fetched: 0, inserted: 0, updated: 0, message }, durationMs);
  }
}
