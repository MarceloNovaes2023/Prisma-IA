import type { IncomingAd } from "./upsert";

type RawRecord = Record<string, unknown>;

function text(record: RawRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function num(record: RawRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

/**
 * Aceita JSON no formato do Radar com apelidos em português.
 * Nada é inferido além do óbvio: o que faltar fica nulo em vez de inventado.
 */
export function normalizeImport(input: unknown, source = "import"): { ads: IncomingAd[]; errors: string[] } {
  const errors: string[] = [];
  let list: unknown[] = [];

  if (Array.isArray(input)) list = input;
  else if (input && typeof input === "object") {
    const container = input as RawRecord;
    const candidate = container.ads ?? container.anuncios ?? container.data ?? container.results;
    if (Array.isArray(candidate)) list = candidate;
    else list = [container];
  }

  const ads: IncomingAd[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(`Registro ${index + 1}: não é um objeto.`);
      return;
    }
    const record = item as RawRecord;
    const body = text(record, ["body", "texto", "ad_text", "ad_creative_body", "copy"]);
    const advertiser = text(record, ["advertiser", "anunciante", "page_name", "brand", "marca"]);

    if (!body) errors.push(`Registro ${index + 1}: sem texto do anúncio ("body").`);
    if (!advertiser) errors.push(`Registro ${index + 1}: sem anunciante ("advertiser").`);
    if (!body || !advertiser) return;

    const externalId =
      text(record, ["external_id", "id", "ad_id", "ad_archive_id"]) ?? `imp_${Date.now()}_${index}`;

    ads.push({
      external_id: externalId,
      source,
      advertiser,
      advertiser_id: text(record, ["advertiser_id", "page_id"]),
      page_verified: num(record, ["page_verified", "verified"]) ? 1 : 0,
      network: text(record, ["network", "rede", "platform"]) ?? "facebook",
      start_date: text(record, ["start_date", "inicio", "ad_delivery_start_time"]) ?? new Date().toISOString().slice(0, 10),
      stop_date: text(record, ["stop_date", "fim", "ad_delivery_stop_time"]),
      country: text(record, ["country", "pais"]) ?? "BR",
      language: text(record, ["language", "idioma"]) ?? "pt",
      gender: text(record, ["gender", "genero"]),
      age_min: num(record, ["age_min", "idade_min"]),
      age_max: num(record, ["age_max", "idade_max"]),
      media_type: text(record, ["media_type", "midia", "format"]) ?? "image",
      cta: text(record, ["cta", "button"]),
      headline: text(record, ["headline", "titulo", "title"]),
      body,
      description: text(record, ["description", "descricao"]),
      landing_url: text(record, ["landing_url", "url", "link", "final_url"]),
      landing_title: text(record, ["landing_title", "titulo_lander"]),
      tech_stack: text(record, ["tech_stack", "tech", "tecnologia"]),
      offer_id: text(record, ["offer_id", "oferta"]),
      affiliate_network: text(record, ["affiliate_network", "rede_afiliado"]),
      likes: num(record, ["likes", "curtidas"]) ?? 0,
      comments: num(record, ["comments", "comentarios"]) ?? 0,
      shares: num(record, ["shares", "compartilhamentos"]) ?? 0,
      snapshot_url: text(record, ["snapshot_url", "creative_url"]),
    });
  });

  return { ads, errors };
}
