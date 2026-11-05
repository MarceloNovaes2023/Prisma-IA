import { radarDb } from "./db";
import type { AdRow, RadarFilters, SearchResult } from "./types";
import { dateOnly } from "./score";

const PAGE_SIZE = 24;

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function matchExpression(query: string, field: string | undefined): string | null {
  const tokens = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .slice(0, 8);
  if (tokens.length === 0) return null;

  const column =
    field === "corpo"
      ? "body"
      : field === "titulo"
        ? "headline"
        : field === "comentarios"
          ? "comments"
          : field === "lander"
            ? "landing_title"
            : field === "anunciante"
              ? "advertiser"
              : null;

  const parts = tokens.map((token) => (column ? `${column} : "${token}"*` : `"${token}"*`));
  return parts.join(" ");
}

const AGE_BUCKETS: Record<string, [number, number]> = {
  "18-24": [18, 24],
  "25-34": [25, 34],
  "35-44": [35, 44],
  "45-54": [45, 54],
  "55-64": [55, 64],
  "65+": [65, 99],
};

type Built = { join: string; where: string; params: (string | number)[] };

export function buildWhere(filters: RadarFilters): Built {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  let join = "";

  if (filters.q?.trim()) {
    const expression = matchExpression(filters.q.trim(), filters.campo);
    if (expression) {
      clauses.push("a.id IN (SELECT rowid FROM radar_ads_fts WHERE radar_ads_fts MATCH ?)");
      params.push(expression);
    }
  }

  if (filters.rede) {
    const networks = filters.rede.split(",").filter(Boolean);
    if (networks.length) {
      clauses.push(`a.network IN (${networks.map(() => "?").join(",")})`);
      params.push(...networks);
    }
  }
  if (filters.origem) {
    clauses.push("a.source = ?");
    params.push(filters.origem);
  }
  if (filters.pais) {
    clauses.push("a.country = ?");
    params.push(filters.pais);
  }
  if (filters.idioma) {
    clauses.push("a.language = ?");
    params.push(filters.idioma);
  }
  if (filters.genero && filters.genero !== "todos") {
    clauses.push("(a.gender = ? OR a.gender = 'all' OR a.gender IS NULL)");
    params.push(filters.genero);
  }
  if (filters.idade && AGE_BUCKETS[filters.idade]) {
    const [min, max] = AGE_BUCKETS[filters.idade];
    clauses.push("a.age_min <= ? AND a.age_max >= ?");
    params.push(max, min);
  }
  if (filters.desde) {
    clauses.push("a.start_date >= ?");
    params.push(filters.desde);
  }
  if (filters.ate) {
    clauses.push("a.start_date <= ?");
    params.push(filters.ate);
  }
  if (filters.visto) {
    const days = Number(filters.visto);
    if (Number.isFinite(days) && days > 0) {
      clauses.push("a.last_seen >= ?");
      params.push(`${dateOnly(days)} 00:00:00`);
    }
  }
  if (filters.durMin) {
    const days = Number(filters.durMin);
    if (Number.isFinite(days) && days > 0) {
      clauses.push("(julianday(COALESCE(a.stop_date, 'now')) - julianday(a.start_date)) >= ?");
      params.push(days);
    }
  }
  if (filters.curMin) {
    clauses.push("a.likes >= ?");
    params.push(Number(filters.curMin) || 0);
  }
  if (filters.curMax) {
    clauses.push("a.likes <= ?");
    params.push(Number(filters.curMax) || 0);
  }
  if (filters.comMin) {
    clauses.push("a.comments >= ?");
    params.push(Number(filters.comMin) || 0);
  }
  if (filters.compMin) {
    clauses.push("a.shares >= ?");
    params.push(Number(filters.compMin) || 0);
  }
  if (filters.cta) {
    clauses.push("a.cta = ?");
    params.push(filters.cta);
  }
  if (filters.midia) {
    clauses.push("a.media_type = ?");
    params.push(filters.midia);
  }
  if (filters.dominio) {
    clauses.push("a.landing_domain LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.dominio)}%`);
  }
  if (filters.marca) {
    clauses.push("a.advertiser LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.marca)}%`);
  }
  if (filters.tech) {
    clauses.push("a.tech_stack LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.tech)}%`);
  }
  if (filters.oferta === "sim") {
    clauses.push("a.offer_id IS NOT NULL");
  } else if (filters.oferta && filters.oferta !== "todos") {
    clauses.push("a.affiliate_network = ?");
    params.push(filters.oferta);
  }
  if (filters.colecao) {
    join = "INNER JOIN radar_collection_items ci ON ci.ad_id = a.id AND ci.collection_id = ?";
    params.unshift(Number(filters.colecao) || 0);
  }

  return { join, where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function orderBy(ordem: string | undefined): string {
  switch (ordem) {
    case "recentes":
      return "a.start_date DESC, a.id DESC";
    case "antigos":
      return "a.start_date ASC, a.id ASC";
    case "duracao":
      return "(julianday(COALESCE(a.stop_date, 'now')) - julianday(a.start_date)) DESC, a.winning_score DESC";
    case "aceleracao":
      return "a.momentum DESC, a.winning_score DESC";
    case "curtidas":
      return "a.likes DESC, a.id DESC";
    case "compartilhamentos":
      return "a.shares DESC, a.id DESC";
    case "comentarios":
      return "a.comments DESC, a.id DESC";
    default:
      return "a.winning_score DESC, a.likes DESC, a.id DESC";
  }
}

export function searchAds(filters: RadarFilters): SearchResult {
  const started = performance.now();
  const db = radarDb();
  const { join, where, params } = buildWhere(filters);
  const page = Math.max(1, Number(filters.pagina) || 1);

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM radar_ads a ${join} ${where}`).get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT a.*, EXISTS (SELECT 1 FROM radar_insight_ads ia WHERE ia.ad_id = a.id) AS has_insight
       FROM radar_ads a ${join} ${where} ORDER BY ${orderBy(filters.ordem)} LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as AdRow[];

  const tookMs = performance.now() - started;

  return {
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    tookMs,
  };
}

export function getAd(id: number): AdRow | null {
  const db = radarDb();
  const row = db.prepare("SELECT * FROM radar_ads WHERE id = ?").get(id) as AdRow | undefined;
  return row ?? null;
}

export type Variant = {
  id: number;
  advertiser: string;
  active: number;
  start_date: string;
  likes: number;
  winning_score: number;
  landing_domain: string | null;
};

export function getVariants(ad: AdRow): Variant[] {
  const db = radarDb();
  return db
    .prepare(
      "SELECT id, advertiser, active, start_date, likes, winning_score, landing_domain FROM radar_ads WHERE fingerprint = ? AND id <> ? ORDER BY winning_score DESC LIMIT 8",
    )
    .all(ad.fingerprint, ad.id) as Variant[];
}

export type BrandStats = {
  name: string;
  ads: number;
  active: number;
  avgScore: number;
  bestScore: number;
  likes: number;
  domains: string[];
  firstSeen: string | null;
  networks: string[];
};

export function brandStats(name: string): BrandStats {
  const db = radarDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, MAX(winning_score) AS bestScore,
              SUM(likes) AS likes, MIN(start_date) AS firstSeen
       FROM radar_ads WHERE advertiser = ?`,
    )
    .get(name) as { ads: number; active: number | null; avgScore: number | null; bestScore: number | null; likes: number | null; firstSeen: string | null };

  const domains = (
    db
      .prepare("SELECT DISTINCT landing_domain FROM radar_ads WHERE advertiser = ? AND landing_domain IS NOT NULL")
      .all(name) as { landing_domain: string }[]
  ).map((row) => row.landing_domain);

  const networks = (
    db.prepare("SELECT DISTINCT network FROM radar_ads WHERE advertiser = ?").all(name) as { network: string }[]
  ).map((row) => row.network);

  return {
    name,
    ads: row.ads,
    active: row.active ?? 0,
    avgScore: Math.round(row.avgScore ?? 0),
    bestScore: Math.round(row.bestScore ?? 0),
    likes: row.likes ?? 0,
    domains,
    firstSeen: row.firstSeen,
    networks,
  };
}

export type Facets = {
  ctas: { value: string; count: number }[];
  dominios: { value: string; count: number }[];
  redes: { value: string; count: number }[];
  fontes: { value: string; count: number }[];
  paises: { value: string; count: number }[];
  techs: { value: string; count: number }[];
  redesAfiliado: { value: string; count: number }[];
};

export function facets(): Facets {
  const db = radarDb();
  const group = (column: string, limit = 12) =>
    db
      .prepare(
        `SELECT ${column} AS value, COUNT(*) AS count FROM radar_ads WHERE ${column} IS NOT NULL AND ${column} <> '' GROUP BY ${column} ORDER BY count DESC LIMIT ${limit}`,
      )
      .all() as { value: string; count: number }[];

  const techRows = db.prepare("SELECT tech_stack FROM radar_ads WHERE tech_stack IS NOT NULL").all() as { tech_stack: string }[];
  const techCount = new Map<string, number>();
  for (const row of techRows) {
    for (const tech of row.tech_stack.split(",")) {
      const key = tech.trim();
      if (!key) continue;
      techCount.set(key, (techCount.get(key) ?? 0) + 1);
    }
  }
  const techs = [...techCount.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 14);

  return {
    ctas: group("cta", 10),
    dominios: group("landing_domain", 10),
    redes: group("network", 4),
    fontes: group("source", 8),
    paises: group("country", 10),
    techs,
    redesAfiliado: group("affiliate_network", 8),
  };
}

export type RadarOverview = {
  ads: number;
  advertisers: number;
  active: number;
  winners: number;
  avgScore: number;
  lastSeen: string | null;
  liveSources: number;
  synthetic: number;
  fresh: number;
  stale: number;
  newestWinner: { id: number; advertiser: string; headline: string | null; score: number; start_date: string } | null;
  topDomains: { domain: string; ads: number; active: number }[];
  topCtas: { cta: string; count: number }[];
};

export function radarOverview(): RadarOverview {
  const db = radarDb();
  const base = db
    .prepare(
      `SELECT COUNT(*) AS ads, COUNT(DISTINCT advertiser) AS advertisers, SUM(active) AS active,
              SUM(CASE WHEN winning_score >= 72 THEN 1 ELSE 0 END) AS winners,
              AVG(winning_score) AS avgScore, MAX(last_seen) AS lastSeen
       FROM radar_ads`,
    )
    .get() as {
    ads: number;
    advertisers: number;
    active: number | null;
    winners: number | null;
    avgScore: number | null;
    lastSeen: string | null;
  };

  const freshness = db
    .prepare(
      `SELECT SUM(CASE WHEN last_seen >= datetime('now', '-2 days') THEN 1 ELSE 0 END) AS fresh,
              SUM(CASE WHEN last_seen < datetime('now', '-2 days') THEN 1 ELSE 0 END) AS stale
       FROM radar_ads`,
    )
    .get() as { fresh: number | null; stale: number | null };

  const liveSources = (
    db.prepare("SELECT COUNT(*) AS n FROM radar_ads WHERE source <> 'sandbox'").get() as { n: number }
  ).n;
  const newestWinner = db
    .prepare(
      "SELECT id, advertiser, headline, winning_score AS score, start_date FROM radar_ads WHERE winning_score >= 72 ORDER BY start_date DESC LIMIT 1",
    )
    .get() as RadarOverview["newestWinner"] | undefined;

  const topDomains = db
    .prepare(
      `SELECT landing_domain AS domain, COUNT(*) AS ads, SUM(active) AS active
       FROM radar_ads WHERE landing_domain IS NOT NULL
       GROUP BY landing_domain ORDER BY ads DESC LIMIT 6`,
    )
    .all() as { domain: string; ads: number; active: number }[];

  const topCtas = db
    .prepare("SELECT cta, COUNT(*) AS count FROM radar_ads WHERE cta IS NOT NULL GROUP BY cta ORDER BY count DESC LIMIT 6")
    .all() as { cta: string; count: number }[];

  return {
    ads: base.ads,
    advertisers: base.advertisers,
    active: base.active ?? 0,
    winners: base.winners ?? 0,
    avgScore: Math.round(base.avgScore ?? 0),
    lastSeen: base.lastSeen,
    liveSources,
    synthetic: (db.prepare("SELECT COUNT(*) AS n FROM radar_ads WHERE source = 'sandbox'").get() as { n: number }).n,
    fresh: freshness.fresh ?? 0,
    stale: freshness.stale ?? 0,
    newestWinner: newestWinner ?? null,
    topDomains,
    topCtas,
  };
}

export type TrendRow = { label: string; ads: number; active: number; avgScore: number; likes: number };

function trendQuery(sql: string): TrendRow[] {
  return radarDb().prepare(sql).all() as TrendRow[];
}

export function trends() {
  const firstWords = trendQuery(`
    SELECT lower(substr(replace(headline, '|', ''), 1, 46)) AS label,
           COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, SUM(likes) AS likes
    FROM radar_ads
    WHERE headline IS NOT NULL AND headline <> ''
    GROUP BY label HAVING ads >= 2
    ORDER BY avgScore DESC LIMIT 8
  `);

  const domains = trendQuery(`
    SELECT landing_domain AS label, COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, SUM(likes) AS likes
    FROM radar_ads WHERE landing_domain IS NOT NULL
    GROUP BY landing_domain ORDER BY COUNT(*) DESC LIMIT 8
  `);

  const ctas = trendQuery(`
    SELECT cta AS label, COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, SUM(likes) AS likes
    FROM radar_ads WHERE cta IS NOT NULL
    GROUP BY cta ORDER BY COUNT(*) DESC LIMIT 8
  `);

  const formats = trendQuery(`
    SELECT media_type AS label, COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, SUM(likes) AS likes
    FROM radar_ads GROUP BY media_type ORDER BY COUNT(*) DESC
  `);

  const advertisers = trendQuery(`
    SELECT advertiser AS label, COUNT(*) AS ads, SUM(active) AS active, AVG(winning_score) AS avgScore, SUM(likes) AS likes
    FROM radar_ads GROUP BY advertiser ORDER BY AVG(winning_score) DESC LIMIT 8
  `);

  return { firstWords, domains, ctas, formats, advertisers };
}
