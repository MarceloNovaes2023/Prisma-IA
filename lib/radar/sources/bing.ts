import type { IncomingAd } from "./upsert";

const DEFAULT_BASE = "https://adlibrary.api.bingads.microsoft.com/api/v1";

/**
 * Microsoft Ad Library — biblioteca oficial de anúncios da Microsoft (Bing),
 * aberta a terceiros sem token. Cobertura documentada: Espaço Econômico Europeu,
 * com 1 a 3 dias de atraso. É a plataforma extra que entra na varredura sem
 * credencial nenhuma; dá para desligar com RADAR_BING_ENABLED=off.
 */
export function bingConfigured(): boolean {
  const raw = process.env.RADAR_BING_ENABLED?.trim().toLowerCase();
  return raw !== "off" && raw !== "0" && raw !== "false";
}

type BingAd = {
  AdId: number;
  AdvertiserName: string;
  AdvertiserId: number;
  Title?: string | null;
  Description?: string | null;
  DisplayUrl?: string | null;
  DestinationUrl?: string | null;
  AssetJson?: string | null;
};

type BingPayload = {
  value?: BingAd[];
  "@odata.count"?: number;
  error?: string | { code?: string; message?: string };
};

function baseUrl(): string {
  return (process.env.BING_AD_LIBRARY_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}

function domainOf(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  const candidate = withoutProtocol.replace(/^www\./, "");
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(candidate) ? candidate : null;
}

function mediaTypeOf(assetJson: string | null | undefined): string {
  if (!assetJson) return "image";
  try {
    const assets = JSON.parse(assetJson) as { AssetType?: string }[];
    const types = assets.map((asset) => (asset.AssetType ?? "").toLowerCase());
    if (types.some((type) => type.includes("video"))) return "video";
    if (types.some((type) => type.includes("image"))) return "image";
  } catch {
    // asset quebrado não impede a coleta do anúncio
  }
  return "image";
}

/** Pistas de idioma — a API não informa o idioma, então inferimos pelo texto. */
const LANGUAGE_HINTS: Record<string, string[]> = {
  pt: [" de ", " para ", " com ", " você ", " não ", " mais ", " seu ", " sua ", " agora ", " aqui "],
  es: [" con ", " más ", " ahora ", " descubre ", " envío ", " tu ", " compra ", " oferta "],
  fr: [" avec ", " pour ", " vos ", " découvrez ", " profitez ", " livraison ", " dès ", " nos "],
  de: [" und ", " mit ", " für ", " jetzt ", " entdecken ", " sichern ", " dein ", " ihre "],
  en: [" the ", " with ", " your ", " now ", " free ", " shop ", " discover ", " get "],
};

export function guessLanguage(text: string): string {
  const padded = ` ${text.toLowerCase().replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
  let best = "und";
  let bestScore = 0;
  for (const [code, words] of Object.entries(LANGUAGE_HINTS)) {
    const score = words.reduce((total, word) => total + padded.split(word).length - 1, 0);
    if (score > bestScore) {
      best = code;
      bestScore = score;
    }
  }
  return best;
}

export function toIncomingBing(ad: BingAd, today = new Date().toISOString().slice(0, 10)): IncomingAd | null {
  const advertiser = ad.AdvertiserName?.trim();
  const body = (ad.Description ?? ad.Title ?? "").trim();
  if (!ad.AdId || !advertiser || !body) return null;

  return {
    external_id: `bing_${ad.AdId}`,
    source: "bing",
    advertiser,
    advertiser_id: ad.AdvertiserId ? String(ad.AdvertiserId) : null,
    network: "microsoft",
    start_date: today,
    country: process.env.BING_AD_LIBRARY_COUNTRY?.trim().toUpperCase() || "EEA",
    language:
      process.env.BING_AD_LIBRARY_LANGUAGE?.trim().toLowerCase().slice(0, 2) ||
      guessLanguage(`${ad.Title ?? ""} ${ad.Description ?? ""} ${ad.AdvertiserName ?? ""}`),
    media_type: mediaTypeOf(ad.AssetJson),
    headline: ad.Title?.trim() || null,
    body,
    description: ad.Description?.trim() || null,
    landing_url: ad.DestinationUrl?.trim() || null,
    landing_domain: domainOf(ad.DisplayUrl) ?? domainOf(ad.DestinationUrl),
    cta: null,
    page_verified: 0,
  };
}

export type BingFetchOptions = { pages?: number; limit?: number; skip?: number };

/** Lê a Ad Library da Microsoft em páginas de OData (`$top`/`$skip`). */
export async function fetchBingAds(options: BingFetchOptions = {}): Promise<IncomingAd[]> {
  const pages = Math.min(Math.max(Math.round(options.pages ?? 2), 1), 5);
  // a API aberta recusa $top acima de 24 ("The limit of '24' for Top query has been exceeded")
  const limit = Math.min(Math.max(Math.round(options.limit ?? 24), 1), 24);
  const timeout = Number(process.env.BING_AD_LIBRARY_TIMEOUT_MS ?? 15_000);
  const today = new Date().toISOString().slice(0, 10);
  const collected = new Map<string, IncomingAd>();

  for (let page = 0; page < pages; page += 1) {
    const skip = (options.skip ?? 0) + page * limit;
    const url = `${baseUrl()}/Ads?$top=${limit}&$skip=${skip}&$orderby=AdId%20desc`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 15_000),
    });

    const payload = (await response.json().catch(() => ({}))) as BingPayload;
    if (!response.ok || payload.error) {
      const detail =
        typeof payload.error === "string"
          ? payload.error
          : payload.error?.message?.trim() || `HTTP ${response.status}`;
      throw new Error(`Microsoft Ad Library respondeu: ${detail}`);
    }

    const ads = payload.value ?? [];
    for (const ad of ads) {
      const incoming = toIncomingBing(ad, today);
      if (incoming) collected.set(incoming.external_id, incoming);
    }
    if (ads.length < limit) break;
  }

  return [...collected.values()];
}
