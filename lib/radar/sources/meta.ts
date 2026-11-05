import type { IncomingAd } from "./upsert";

const DEFAULT_VERSION = "v26.0";
const DEFAULT_COUNTRIES = "PT,IE,ES,DE,FR";

/**
 * Códigos de throttling da Graph API:
 * 4  = application request limit, 17 = user request limit, 32 = page request limit,
 * 613 = custom-level rate limit, 80004 = ads_insights throttle (a Ad Library herda o mesmo balde).
 */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "languages",
  "ad_snapshot_url",
  "ad_reached_countries",
].join(",");

type MetaAd = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  languages?: string[];
  ad_snapshot_url?: string;
  ad_reached_countries?: string[];
};

type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string };
type GraphPayload = { data?: MetaAd[]; paging?: { next?: string; cursors?: { after?: string } }; error?: GraphError };

export type MetaFetchOptions = {
  searchTerms?: string;
  scenario?: string;
  countries?: string;
  activeOnly?: boolean;
  limit?: number;
  pages?: number;
};

export function metaConfigured(): boolean {
  return Boolean(process.env.META_AD_LIBRARY_TOKEN?.trim());
}

/** Host da Graph API. Sobrescrevível apenas para rodar os testes locais contra um duplo. */
function graphBase(): string {
  return (process.env.META_GRAPH_BASE_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
}

function graphVersion(): string {
  const raw = process.env.META_API_VERSION?.trim() || DEFAULT_VERSION;
  return raw.startsWith("v") ? raw : `v${raw}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describeError(error: GraphError | undefined, status: number): string {
  const code = error?.code;
  const detail = error?.message?.trim();
  if (code === 190 || code === 102) {
    return "Token da Ad Library inválido ou expirado (código 190/102). Gere um novo token no app Meta e atualize META_AD_LIBRARY_TOKEN.";
  }
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) {
    return `Limite de chamadas da Meta atingido (código ${code}). A sincronização tenta de novo com backoff; se persistir, reduza as páginas por execução.`;
  }
  if (code === 100) {
    return `Parâmetro recusado pela Meta (código 100)${detail ? `: ${detail}` : ""}. Confira META_AD_LIBRARY_COUNTRIES — o país precisa ter cobertura de anúncio comercial na Ad Library.`;
  }
  if (status >= 500) return `Graph API indisponível (HTTP ${status}).`;
  return detail || `Graph API respondeu HTTP ${status}.`;
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const base = Number(process.env.META_RETRY_BASE_MS ?? 1000);
  const header = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (Number.isFinite(header) && header > 0) return Math.min(header, 15_000);
  return Math.min(Math.max(base, 100) * 2 ** attempt, 15_000);
}

/** GET na Graph API com retry exponencial em throttling e erro 5xx. */
async function graphGet(url: string): Promise<GraphPayload> {
  const attempts = clamp(Number(process.env.META_RETRY_ATTEMPTS ?? 3), 1, 6);
  let lastMessage = "Falha desconhecida na Ad Library";

  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const payload = (await response.json().catch(() => ({}))) as GraphPayload;
    const error = payload.error;

    if (response.ok && !error) return payload;

    lastMessage = describeError(error, response.status);
    const code = error?.code;
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      (code !== undefined && RATE_LIMIT_CODES.has(code));

    if (!retryable || attempt === attempts - 1) throw new Error(lastMessage);
    await sleep(backoffMs(attempt, response.headers.get("retry-after")));
  }

  throw new Error(lastMessage);
}

function networkOf(platforms: string[]): string {
  const upper = platforms.map((platform) => platform.toUpperCase());
  if (upper.includes("FACEBOOK")) return "facebook";
  if (upper.includes("INSTAGRAM")) return "instagram";
  if (upper.includes("AUDIENCE_NETWORK")) return "audience_network";
  if (upper.includes("MESSENGER")) return "messenger";
  return (platforms[0] ?? "facebook").toLowerCase();
}

/** A "caption" do criativo costuma ser o domínio exibido (ex.: loja.com.br). */
function displayDomain(caption: string | undefined): string | null {
  const value = caption?.trim();
  if (!value) return null;
  const candidate = value.split("/")[0].toLowerCase();
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(candidate) ? candidate.replace(/^www\./, "") : null;
}

function toIncoming(ad: MetaAd, fallbackCountry: string): IncomingAd {
  const bodies = (ad.ad_creative_bodies ?? []).map((body) => body?.trim()).filter(Boolean) as string[];
  const caption = ad.ad_creative_link_captions?.[0];

  return {
    external_id: ad.id,
    source: "meta",
    advertiser: ad.page_name?.trim() || `Página ${ad.page_id ?? ad.id}`,
    advertiser_id: ad.page_id ?? null,
    network: networkOf(ad.publisher_platforms ?? []),
    start_date: ad.ad_delivery_start_time?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    stop_date: ad.ad_delivery_stop_time?.slice(0, 10) ?? null,
    country: ad.ad_reached_countries?.[0] ?? fallbackCountry,
    language: (ad.languages?.[0] ?? "pt").slice(0, 2).toLowerCase(),
    media_type: "image",
    headline: ad.ad_creative_link_titles?.[0]?.trim() ?? null,
    body: bodies.join("\n\n") || "(criativo sem texto na API)",
    description: ad.ad_creative_link_descriptions?.[0]?.trim() ?? null,
    landing_domain: displayDomain(caption),
    landing_url: null,
    snapshot_url: ad.ad_snapshot_url ?? null,
    page_verified: 0,
  };
}

/**
 * Consulta a Ad Library oficial (`/ads_archive`).
 * Cobertura documentada: anúncio comercial só é retornado para UE/Reino Unido;
 * no resto do mundo a API devolve apenas anúncio político e de interesse social.
 */
export async function fetchMetaAds(options: MetaFetchOptions = {}): Promise<IncomingAd[]> {
  const token = process.env.META_AD_LIBRARY_TOKEN?.trim();
  if (!token) throw new Error("META_AD_LIBRARY_TOKEN não configurado");

  const countries = options.countries?.trim() || process.env.META_AD_LIBRARY_COUNTRIES?.trim() || DEFAULT_COUNTRIES;
  const maxPages = clamp(options.pages ?? 3, 1, 10);
  const limit = clamp(options.limit ?? 50, 10, 100);
  const searchTerms = options.searchTerms?.trim().slice(0, 100);

  const params = new URLSearchParams({
    access_token: token,
    ad_reached_countries: countries,
    ad_active_status: options.activeOnly === false ? "ALL" : "ACTIVE",
    ad_type: "ALL",
    fields: FIELDS,
    limit: String(limit),
    ...(searchTerms ? { search_terms: searchTerms } : {}),
    ...(options.scenario ? { STUB_SCENARIO: options.scenario } : {}),
  });

  let url = `${graphBase()}/${graphVersion()}/ads_archive?${params.toString()}`;
  const seen = new Set<string>();
  const collected: MetaAd[] = [];

  for (let page = 0; page < maxPages; page++) {
    const payload = await graphGet(url);

    for (const ad of payload.data ?? []) {
      if (!ad?.id || seen.has(ad.id)) continue;
      seen.add(ad.id);
      collected.push(ad);
    }

    const next = payload.paging?.next;
    if (!next || !payload.data?.length) break;

    // o cursor do paging pode vir sem o token; sem ele a próxima página dá 190
    if (/[?&]access_token=/.test(next)) {
      url = next;
    } else {
      const parsed = new URL(next);
      parsed.searchParams.set("access_token", token);
      url = parsed.toString();
    }
  }

  return collected.map((ad) => toIncoming(ad, countries.split(",")[0].trim().toUpperCase()));
}
