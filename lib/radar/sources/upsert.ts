import type { DatabaseSync } from "node:sqlite";
import { nowStamp } from "@/lib/format";
import { indexAd } from "../db";
import { buildSeries, fingerprintOf, momentumOf, parseSeries, winningScore } from "../score";

export type IncomingAd = {
  external_id: string;
  source: string;
  advertiser: string;
  advertiser_id?: string | null;
  page_verified?: number;
  network: string;
  start_date: string;
  stop_date?: string | null;
  country?: string;
  language?: string;
  gender?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  media_type?: string;
  cta?: string | null;
  headline?: string | null;
  body: string;
  description?: string | null;
  landing_url?: string | null;
  landing_domain?: string | null;
  landing_title?: string | null;
  redirect_chain?: string[] | null;
  tech_stack?: string | null;
  offer_id?: string | null;
  affiliate_network?: string | null;
  likes?: number;
  comments?: number;
  shares?: number;
  snapshot_url?: string | null;
};

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dayOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Recalcula score e agrupamento de todos os anúncios de um mesmo criativo. */
export function recomputeFingerprints(db: DatabaseSync, fingerprints: string[]) {
  const update = db.prepare(
    "UPDATE radar_ads SET winning_score = ?, momentum = ?, variant_count = ?, copy_count = ? WHERE id = ?",
  );

  for (const fingerprint of new Set(fingerprints)) {
    const group = db
      .prepare(
        `SELECT id, advertiser, start_date, stop_date, likes, comments, shares, active, landing_domain, landing_title, tech_stack, cta
         FROM radar_ads WHERE fingerprint = ?`,
      )
      .all(fingerprint) as {
      id: number;
      advertiser: string;
      start_date: string;
      stop_date: string | null;
      likes: number;
      comments: number;
      shares: number;
      active: number;
      landing_domain: string | null;
      landing_title: string | null;
      tech_stack: string | null;
      cta: string | null;
    }[];
    if (group.length === 0) continue;

    const variants = group.length;

    for (const item of group) {
      const copies = new Set(group.filter((other) => other.advertiser !== item.advertiser).map((other) => other.advertiser)).size;
      const start = new Date(`${item.start_date}T00:00:00Z`).getTime();
      const end = item.stop_date ? new Date(`${item.stop_date}T00:00:00Z`).getTime() : Date.now();
      const days = Math.max(1, Math.round((end - start) / 86_400_000));
      const seriesRow = db.prepare("SELECT likes_series FROM radar_ads WHERE id = ?").get(item.id) as {
        likes_series: string;
      };
      const series = parseSeries(seriesRow.likes_series);
      const momentum = series.length > 7 ? momentumOf(series, days, item.likes) : 1;

      const { score } = winningScore({
        days,
        likes: item.likes,
        comments: item.comments,
        shares: item.shares,
        momentum,
        variants,
        copies,
        hasLanding: Boolean(item.landing_domain),
        hasTitle: Boolean(item.landing_title),
        hasTech: Boolean(item.tech_stack),
        hasCta: Boolean(item.cta),
        active: item.active === 1,
      });

      update.run(score, Number(momentum.toFixed(2)), variants, copies, item.id);
    }
  }
}

export function upsertAds(db: DatabaseSync, ads: IncomingAd[], source: string) {
  const insert = db.prepare(`
    INSERT INTO radar_ads (
      external_id, source, advertiser, advertiser_id, page_verified, network, start_date, stop_date,
      first_seen, last_seen, active, country, language, gender, age_min, age_max, media_type, cta,
      headline, body, description, landing_url, landing_domain, landing_title, redirect_chain, tech_stack,
      offer_id, affiliate_network, likes, comments, shares, reactions, likes_series, best_comments,
      fingerprint, winning_score, momentum, variant_count, copy_count, snapshot_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 0, 1, 1, 0, ?, ?)
  `);

  const existing = db.prepare("SELECT id, advertiser FROM radar_ads WHERE external_id = ?");
  const knownBrands = new Set(
    (db.prepare("SELECT name FROM radar_brands").all() as { name: string }[]).map((row) => row.name),
  );

  let inserted = 0;
  let updated = 0;
  const touched: string[] = [];

  for (const ad of ads) {
    if (!ad.external_id || !ad.advertiser || !ad.body) continue;
    const fingerprint = fingerprintOf(ad.headline ?? null, ad.body);
    touched.push(fingerprint);

    const startDate = dayOnly(ad.start_date) ?? new Date().toISOString().slice(0, 10);
    const stopDate = dayOnly(ad.stop_date);
    const active = stopDate ? 0 : 1;
    const url = ad.landing_url ?? null;
    // a fonte pode informar o domínio sem a URL completa (a Ad Library devolve o domínio exibido)
    const domain = ad.landing_domain ?? domainOf(url);
    const reached = existing.get(ad.external_id) as { id: number; advertiser: string } | undefined;

    if (reached) {
      db.prepare(
        `UPDATE radar_ads SET
           last_seen = ?, stop_date = ?, active = ?, body = ?, headline = ?, description = ?,
           landing_url = ?, landing_domain = ?, landing_title = ?, media_type = ?, cta = ?,
           snapshot_url = COALESCE(?, snapshot_url), fingerprint = ?
         WHERE id = ?`,
      ).run(
        nowStamp(),
        stopDate,
        active,
        ad.body,
        ad.headline ?? null,
        ad.description ?? null,
        url,
        domain,
        ad.landing_title ?? null,
        ad.media_type ?? "image",
        ad.cta ?? null,
        ad.snapshot_url ?? null,
        fingerprint,
        reached.id,
      );
      indexAd(db, reached.id, {
        body: ad.body,
        headline: ad.headline ?? null,
        landing_title: ad.landing_title ?? null,
        advertiser: ad.advertiser,
        comments: null,
      });
      updated++;
      continue;
    }

    const likes = ad.likes ?? 0;
    const series = likes > 0 ? buildSeries(likes, 30, "steady") : [];

    const result = insert.run(
      ad.external_id,
      ad.source || source,
      ad.advertiser,
      ad.advertiser_id ?? null,
      ad.page_verified ?? 0,
      ad.network,
      startDate,
      stopDate,
      nowStamp(),
      nowStamp(),
      active,
      ad.country ?? "BR",
      ad.language ?? "pt",
      ad.gender ?? "all",
      ad.age_min ?? 18,
      ad.age_max ?? 65,
      ad.media_type ?? "image",
      ad.cta ?? null,
      ad.headline ?? null,
      ad.body,
      ad.description ?? null,
      url,
      domain,
      ad.landing_title ?? null,
      ad.redirect_chain ? JSON.stringify(ad.redirect_chain) : null,
      ad.tech_stack ?? null,
      ad.offer_id ?? null,
      ad.affiliate_network ?? null,
      likes,
      ad.comments ?? 0,
      ad.shares ?? 0,
      JSON.stringify({ like: likes, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 }),
      JSON.stringify(series),
      fingerprint,
      ad.snapshot_url ?? null,
      nowStamp(),
    );

    const id = Number(result.lastInsertRowid);
    inserted++;

    indexAd(db, id, {
      body: ad.body,
      headline: ad.headline ?? null,
      landing_title: ad.landing_title ?? null,
      advertiser: ad.advertiser,
      comments: null,
    });

    // alertas: marca monitorada publicou algo novo
    const brand = db
      .prepare("SELECT id FROM radar_brands WHERE name = ? OR (domain IS NOT NULL AND domain = ?)")
      .get(ad.advertiser, domain) as { id: number } | undefined;
    if (brand || knownBrands.has(ad.advertiser)) {
      db.prepare("INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, created_at) VALUES (?, ?, ?, ?, ?)").run(
        "new_ad",
        id,
        brand?.id ?? null,
        `${ad.advertiser} publicou um anúncio novo (${ad.network}).`,
        nowStamp(),
      );
    }

    // alertas: criativo já rodando em outra conta (clone)
    const sameCreative = db
      .prepare("SELECT advertiser FROM radar_ads WHERE fingerprint = ? AND id <> ? LIMIT 3")
      .all(fingerprint, id) as { advertiser: string }[];
    if (sameCreative.length > 0 && sameCreative.some((other) => other.advertiser !== ad.advertiser)) {
      db.prepare("INSERT INTO radar_alerts (kind, ad_id, brand_id, detail, created_at) VALUES (?, ?, ?, ?, ?)").run(
        "clone",
        id,
        brand?.id ?? null,
        `${ad.advertiser} está rodando o mesmo criativo de ${sameCreative[0].advertiser}.`,
        nowStamp(),
      );
    }
  }

  recomputeFingerprints(db, touched);
  return { inserted, updated };
}

export function recordSync(
  db: DatabaseSync,
  source: string,
  status: string,
  payload: { fetched: number; inserted: number; updated: number; message?: string | null; durationMs: number },
) {
  db.prepare(
    `INSERT INTO radar_syncs (source, status, fetched, inserted, updated, message, started_at, finished_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    source,
    status,
    payload.fetched,
    payload.inserted,
    payload.updated,
    payload.message ?? null,
    nowStamp(),
    nowStamp(),
    Math.round(payload.durationMs),
  );
}
