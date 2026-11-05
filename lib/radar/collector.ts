import type { IncomingAd } from "./sources/upsert";

type RawRecord = Record<string, unknown>;

/* -------------------------------------------------------------------------- *
 * Coletor próprio de anúncios do Brasil
 * -------------------------------------------------------------------------- *
 * Entrada: JSON ou CSV ou HTML de marketplace/plataforma brasileira.
 * Saída: array de `IncomingAd` pronto para `upsertAds`.
 *
 * Camada de coleta (onde os dados vêm) e camada de ingestão (como entram no
 * Radar) ficam separadas propositalmente. O coletor só transforma; quem
 * decide se os dados são confiáveis é quem os fornece.
 * ------------------------------------------------------------------------- */

/** Aceita JSON no formato do Radar (array ou objeto container). */
export function normalizeJson(input: unknown, source = "import"): { ads: IncomingAd[]; errors: string[] } {
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

/** Campos do Radar que aceitam apelidos em português. */
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

/** Parseia CSV (RFC 4180 com aspas). Para formatações exportadas por marketplace brasileiro. */
export function parseCsv(csv: string): RawRecord[] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuote) {
      if (ch === '"' && i + 1 < csv.length && csv[i + 1] === '"') {
        field += '"';
        i++;
        continue;
      }
      if (ch === '"') { inQuote = false; continue; }
      field += ch;
    } else {
      if (ch === '"') { inQuote = true; continue; }
      if (ch === ",") { current.push(field); field = ""; continue; }
      if (ch === "\n") { current.push(field); lines.push(current); current = []; field = ""; continue; }
      if (ch !== "\r") field += ch;
    }
  }
  if (field || current.length) { current.push(field); }

  if (lines.length < 1) { return []; }
  const header = lines[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => { record[key] = (row[i] ?? "").trim(); });
    return record as unknown as RawRecord;
  });
}

/** Extrai tabela HTML simples (`<table>` com `<thead>`/`<tbody>`) exportada como HTML de alguns marketplaces.
 *  Usa um parser baseado em split por tags de célula e linha.
 *  Primeiro extrai todas as linhas `<tr>...</tr>`, depois para cada linha extrai as células `<td>...</td>` ou `<th>...</th>`.
 */
export function parseHtmlTable(html: string): RawRecord[] {
  const rows: string[][] = [];

  // Remove quebras de linha para simplificar
  const flatHtml = html.replace(/\n/g, " ");

  // Extraindo todas as linhas <tr>...</tr>
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(flatHtml)) !== null) {
    const lineContent = trMatch[1];
    const row: string[] = [];

    // Extraindo células <td>...</td> ou <th>...</th>
    const tdPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdPattern.exec(lineContent)) !== null) {
      row.push(tdMatch[1]);
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => { record[key] = (row[i] ?? "").trim(); });
    return record as unknown as RawRecord;
  });
}

/** Coleta de uma resposta de marketplace/plataforma brasileira.
 *  Suporta JSON, CSV e HTML de tabela.
 *  O `source` padrão é "import"; quem usa pode sobreescrever.
 */
export function collect(raw: string, source = "import"): { ads: IncomingAd[]; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    return normalizeJson(parsed, source);
  } catch {
    // não JSON — tenta HTML de tabela primeiro (pode ter vírgula e quebra dentro de células)
    if (/<table/i.test(raw) || /<thead/i.test(raw) || /<tbody/i.test(raw) || /<tr/i.test(raw) || /<td/i.test(raw) || /<th/i.test(raw)) {
      const records = parseHtmlTable(raw);
      if (records.length > 0) {
        return normalizeCsv(records, source);
      }
    }
    // tenta CSV (precisa de vírgula e quebra de linha)
    if (raw.includes(",") && raw.includes("\n")) {
      const records = parseCsv(raw);
      if (records.length > 0) {
        return normalizeCsv(records, source);
      }
    }
    return { ads: [], errors: ["Formato não reconhecido. Envie JSON, CSV ou HTML de tabela."] };
  }
}

function normalizeCsv(records: RawRecord[], source: string): { ads: IncomingAd[]; errors: string[] } {
  const errors: string[] = [];
  const ads: IncomingAd[] = [];
  records.forEach((record, index) => {
    const body = text(record, ["body", "texto", "ad_text", "ad_creative_body", "copy", "copy_do_anuncio", "texto_do_anuncio"]);
    const advertiser = text(record, ["advertiser", "anunciante", "page_name", "brand", "marca", "loja", "vendedor"]);

    if (!body) errors.push(`Registro ${index + 1}: sem texto do anúncio.`);
    if (!advertiser) errors.push(`Registro ${index + 1}: sem anunciante.`);
    if (!body || !advertiser) return;

    const externalId =
      text(record, ["external_id", "id", "ad_id", "titulo", "nome_anuncio", "link"]) ?? `csv_${Date.now()}_${index}`;

    ads.push({
      external_id: externalId,
      source: source || "import",
      advertiser,
      advertiser_id: text(record, ["advertiser_id", "id_anunciante", "page_id"]),
      page_verified: num(record, ["page_verified", "verificado"]) ? 1 : 0,
      network: text(record, ["network", "rede", "plataforma", "platform", "site"]) ?? "facebook",
      start_date: text(record, ["start_date", "inicio", "data_inicio", "data"]) ?? new Date().toISOString().slice(0, 10),
      stop_date: text(record, ["stop_date", "fim", "data_fim"]),
      country: text(record, ["country", "pais", "pais_destino"]) ?? "BR",
      language: text(record, ["language", "idioma"]) ?? "pt",
      gender: text(record, ["gender", "genero", "publico"]),
      age_min: num(record, ["age_min", "idade_min", "faixa_inicio"]),
      age_max: num(record, ["age_max", "idade_max", "faixa_fim"]),
      media_type: text(record, ["media_type", "midia", "format", "tipo_midia", "tipo"]) ?? "image",
      cta: text(record, ["cta", "botao", "button", "acao", "link_botao"]),
      headline: text(record, ["headline", "titulo", "title", "nome", "nome_anuncio"]),
      body,
      description: text(record, ["description", "descricao", "desc"]),
      landing_url: text(record, ["landing_url", "url", "link", "link_final", "url_anuncio", "link_anuncio"]),
      landing_title: text(record, ["landing_title", "titulo_lander", "titulo_pagina"]),
      tech_stack: text(record, ["tech_stack", "tech", "tecnologia", "plataforma_tecnologia"]),
      offer_id: text(record, ["offer_id", "oferta", "promocao"]),
      affiliate_network: text(record, ["affiliate_network", "rede_afiliado", "programa_afiliados"]),
      likes: num(record, ["likes", "curtidas", "interessados"]) ?? 0,
      comments: num(record, ["comments", "comentarios", "comentarios_count"]) ?? 0,
      shares: num(record, ["shares", "compartilhamentos", "compartilhamentos_count"]) ?? 0,
      snapshot_url: text(record, ["snapshot_url", "creative_url", "url_criativo", "link_criativo", "imagem"]),
    });
  });
  return { ads, errors };
}
