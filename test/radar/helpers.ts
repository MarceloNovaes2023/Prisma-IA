import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { radarDb, rebuildIndex } from "@/lib/radar/db";

/** Aponta o app para um banco temporário e devolve o caminho do arquivo. */
export function useTestDatabase(): string {
  const file = path.join(
    os.tmpdir(),
    `fluxo-radar-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`,
  );
  process.env.FLUXO_DB = file;
  delete (globalThis as { __fluxoDb?: unknown }).__fluxoDb;
  return file;
}

export function cleanupTestDatabase(file: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${file}${suffix}`, { force: true });
    } catch {
      // arquivo já removido — nada a fazer
    }
  }
}

export type RadarFixtures = {
  bella: number;
  sono: number;
  curso: number;
  atacado: number;
  ugc: number;
  atacadoName: string;
};

type AdSeed = {
  key: "bella" | "sono" | "curso";
  external_id: string;
  advertiser: string;
  network: string;
  country: string;
  start_date: string;
  headline: string;
  body: string;
  landing_domain: string;
  likes: number;
  comments: number;
  shares: number;
  score: number;
  active: number;
};

const ADS: AdSeed[] = [
  {
    key: "bella",
    external_id: "test-bella-1",
    advertiser: "Atacado Bella Moda",
    network: "facebook",
    country: "BR",
    start_date: "2026-09-01",
    headline: "Coleção verão em atacado com 18% OFF",
    body: "Grade fechada de verão com 12 peças por R$ 349 para revendedoras.",
    landing_domain: "atacadobellamoda.com.br",
    likes: 1200,
    comments: 90,
    shares: 40,
    score: 92,
    active: 1,
  },
  {
    key: "sono",
    external_id: "test-sono-1",
    advertiser: "Colchões Sono Leve",
    network: "instagram",
    country: "PT",
    start_date: "2026-10-01",
    headline: "Colchão queen com 29% OFF",
    body: "Colchão queen molas ensacadas com 120 noites de teste em casa.",
    landing_domain: "somoleve.pt",
    likes: 400,
    comments: 25,
    shares: 10,
    score: 78,
    active: 1,
  },
  {
    key: "curso",
    external_id: "test-curso-1",
    advertiser: "Escola Tráfego Pro",
    network: "tiktok",
    country: "BR",
    start_date: "2026-08-01",
    headline: "Aprenda a escalar campanhas",
    body: "Curso de tráfego pago com aulas práticas de escala.",
    landing_domain: "trafegopro.com.br",
    likes: 90,
    comments: 3,
    shares: 1,
    score: 55,
    active: 0,
  },
];

/**
 * Zera o Radar e grava um conjunto fixo de anúncios e coleções,
 * para que busca, briefing e lead tenham dados previsíveis.
 */
export function seedRadarFixtures(): RadarFixtures {
  const db = radarDb();

  db.exec(`
    DELETE FROM radar_lead_origins;
    DELETE FROM radar_campaigns;
    DELETE FROM radar_briefs;
    DELETE FROM radar_collection_items;
    DELETE FROM radar_collections;
    DELETE FROM radar_ads_fts;
    DELETE FROM radar_ads;
  `);

  const insertAd = db.prepare(`
    INSERT INTO radar_ads (
      external_id, source, advertiser, network, start_date, stop_date, first_seen, last_seen, active,
      country, language, gender, age_min, age_max, media_type, cta, headline, body,
      landing_url, landing_domain, landing_title, likes, comments, shares, fingerprint,
      winning_score, momentum, variant_count, created_at
    ) VALUES (?, 'test', ?, ?, ?, NULL, ?, ?, ?, ?, 'pt', 'all', 25, 55, 'image', 'Comprar',
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1.2, 1, ?)
  `);

  const ids = {} as Pick<RadarFixtures, "bella" | "sono" | "curso">;
  for (const ad of ADS) {
    const stamp = `${ad.start_date} 08:00:00`;
    const result = insertAd.run(
      ad.external_id,
      ad.advertiser,
      ad.network,
      ad.start_date,
      stamp,
      stamp,
      ad.active,
      ad.country,
      ad.headline,
      ad.body,
      `https://${ad.landing_domain}/`,
      ad.landing_domain,
      ad.headline,
      ad.likes,
      ad.comments,
      ad.shares,
      `fp-${ad.external_id}`,
      ad.score,
      stamp,
    );
    ids[ad.key] = Number(result.lastInsertRowid);
  }

  const atacadoName = "Ganchos de atacado";
  const atacado = Number(
    db
      .prepare("INSERT INTO radar_collections (name, color, created_at) VALUES (?, '#a3f04b', '2026-10-30 09:00:00')")
      .run(atacadoName).lastInsertRowid,
  );
  const ugc = Number(
    db
      .prepare("INSERT INTO radar_collections (name, color, created_at) VALUES (?, '#9a86ff', '2026-10-30 09:10:00')")
      .run("Vídeos UGC que escalaram").lastInsertRowid,
  );

  const addItem = db.prepare(
    "INSERT INTO radar_collection_items (collection_id, ad_id, created_at) VALUES (?, ?, '2026-10-30 09:20:00')",
  );
  addItem.run(atacado, ids.bella);
  addItem.run(ugc, ids.sono);

  rebuildIndex(db);

  return { ...ids, atacado, ugc, atacadoName };
}

/** Garante que nenhuma chave de API do Radar vaze entre os testes. */
export function clearRadarKeys(): void {
  delete process.env.RADAR_API_KEY;
  delete process.env.INTAKE_API_KEY;
}

export function getRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/radar${pathname}`), { headers });
}

export function postRequest(pathname: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/radar${pathname}`), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
