import type { IncomingAd } from "./upsert";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const QUERY_URL = "https://open.tiktokapis.com/v2/research/adlib/ad/query/";

const FIELDS = [
  "ad.id",
  "ad.first_shown_date",
  "ad.last_shown_date",
  "ad.status",
  "ad.status_statement",
  "ad.image_urls",
  "ad.videos",
  "ad.reach",
  "advertiser.business_id",
  "advertiser.business_name",
  "advertiser.paid_for_by",
];

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!payload.access_token) {
    throw new Error(payload.error_description || payload.error || `TikTok recusou a autenticação (${response.status})`);
  }
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 7200) * 1000 };
  return payload.access_token;
}

type TikTokAd = {
  id: string;
  first_shown_date?: string;
  last_shown_date?: string;
  status?: string;
  image_urls?: string[];
  videos?: unknown[];
  reach?: number;
  advertiser?: { business_id?: string; business_name?: string; paid_for_by?: string };
  title?: string;
  ad_title?: string;
};

export type TikTokFetchOptions = { searchTerm?: string; countries?: string[]; maxCount?: number };

/**
 * Commercial Content API: cobertura exclusiva da União Europeia,
 * 10 resultados por página e janela máxima de 1 ano.
 */
export async function fetchTikTokAds(options: TikTokFetchOptions = {}): Promise<IncomingAd[]> {
  if (!tiktokConfigured()) throw new Error("TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET não configurados");
  const token = await accessToken();

  const today = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 300);

  const body = {
    fields: FIELDS,
    filters: {
      ad_published_date_range: {
        min: start.toISOString().slice(0, 10),
        max: today.toISOString().slice(0, 10),
      },
      country_code_list: options.countries?.length ? options.countries : ["DE", "FR", "ES", "IT", "PT"],
      ad_status: "ACTIVE",
      ...(options.searchTerm?.trim() ? { search_term: options.searchTerm.trim().slice(0, 50), search_type: "fuzzy_phrase" } : {}),
    },
    max_count: Math.min(10, Math.max(1, options.maxCount ?? 10)),
  };

  const response = await fetch(QUERY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    data?: { ads?: TikTokAd[] };
    error?: { code?: string; message?: string };
  };

  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(payload.error.message || `TikTok recusou a consulta (${payload.error.code})`);
  }

  return (payload.data?.ads ?? []).map((ad) => {
    const business = ad.advertiser?.business_name ?? "Anunciante TikTok";
    const hasVideo = Array.isArray(ad.videos) && ad.videos.length > 0;
    return {
      external_id: `tt_${ad.id}`,
      source: "tiktok",
      advertiser: business,
      advertiser_id: ad.advertiser?.business_id ?? null,
      network: "tiktok",
      start_date: ad.first_shown_date ?? new Date().toISOString().slice(0, 10),
      stop_date: ad.status === "ACTIVE" ? null : (ad.last_shown_date ?? null),
      country: "EU",
      language: "xx",
      media_type: hasVideo ? "video" : "image",
      headline: ad.ad_title ?? ad.title ?? null,
      body:
        ad.ad_title?.trim() ||
        `Criativo em ${hasVideo ? "vídeo" : "imagem"} veiculado por ${business} na União Europeia (sem texto na API).`,
      landing_url: null,
      page_verified: 0,
    } satisfies IncomingAd;
  });
}
