import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/radar/ads/route";
import {
  clearRadarKeys,
  cleanupTestDatabase,
  getRequest,
  seedRadarFixtures,
  useTestDatabase,
  type RadarFixtures,
} from "./helpers";

const dbFile = useTestDatabase();
let fixtures: RadarFixtures;

type AdsPayload = {
  total: number;
  page: number;
  pages: number;
  tookMs: number;
  ads: {
    id: number;
    externalId: string;
    advertiser: string;
    network: string;
    active: boolean;
    country: string;
    headline: string | null;
    body: string;
    landingDomain: string | null;
    winningScore: number;
    engagement: { likes: number; comments: number; shares: number };
  }[];
};

async function search(pathname: string, headers: Record<string, string> = {}): Promise<{ status: number; payload: AdsPayload; cacheControl: string | null }> {
  const response = await GET(getRequest(pathname, headers));
  return {
    status: response.status,
    payload: (await response.json()) as AdsPayload,
    cacheControl: response.headers.get("cache-control"),
  };
}

beforeAll(() => {
  fixtures = seedRadarFixtures();
  clearRadarKeys();
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("GET /api/radar/ads", () => {
  it("lista os anúncios do banco com o contrato público", async () => {
    const { status, payload, cacheControl } = await search("/ads");

    expect(status).toBe(200);
    expect(cacheControl).toBe("no-store");
    expect(payload.total).toBe(3);
    expect(payload.page).toBe(1);
    expect(payload.pages).toBe(1);
    expect(payload.ads).toHaveLength(3);

    const bella = payload.ads.find((ad) => ad.id === fixtures.bella);
    expect(bella).toMatchObject({
      externalId: "test-bella-1",
      advertiser: "Atacado Bella Moda",
      network: "facebook",
      active: true,
      country: "BR",
      landingDomain: "atacadobellamoda.com.br",
      winningScore: 92,
      engagement: { likes: 1200, comments: 90, shares: 40 },
    });
    expect(bella).not.toHaveProperty("winning_score");
    expect(bella).not.toHaveProperty("external_id");
  });

  it("busca por texto sem acento no corpo do anúncio", async () => {
    const { status, payload } = await search("/ads?q=colchao");

    expect(status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.ads.map((ad) => ad.id)).toEqual([fixtures.sono]);
  });

  it("busca restrita ao campo título", async () => {
    const { payload } = await search("/ads?q=escalar&campo=titulo");

    expect(payload.total).toBe(1);
    expect(payload.ads[0]?.id).toBe(fixtures.curso);
  });

  it("filtra por rede social", async () => {
    const { payload } = await search("/ads?rede=instagram");

    expect(payload.total).toBe(1);
    expect(payload.ads[0]?.id).toBe(fixtures.sono);
  });

  it("filtra por país", async () => {
    const { payload } = await search("/ads?pais=BR");

    expect(payload.total).toBe(2);
    expect(payload.ads.map((ad) => ad.id).sort()).toEqual([fixtures.bella, fixtures.curso].sort());
  });

  it("filtra pelos anúncios de uma coleção", async () => {
    const { payload } = await search(`/ads?colecao=${fixtures.atacado}`);

    expect(payload.total).toBe(1);
    expect(payload.ads[0]?.id).toBe(fixtures.bella);
  });

  it("ordena pelos mais recentes", async () => {
    const { payload } = await search("/ads?ordem=recentes");

    expect(payload.ads.map((ad) => ad.id)).toEqual([fixtures.sono, fixtures.bella, fixtures.curso]);
  });

  it("exige x-api-key quando RADAR_API_KEY está configurada", async () => {
    process.env.RADAR_API_KEY = "segredo-radar";
    try {
      const semChave = await search("/ads");
      expect(semChave.status).toBe(401);
      expect(semChave.payload).toMatchObject({ error: "unauthorized" });

      const chaveErrada = await search("/ads", { "x-api-key": "outra" });
      expect(chaveErrada.status).toBe(401);

      const comHeader = await search("/ads", { "x-api-key": "segredo-radar" });
      expect(comHeader.status).toBe(200);
      expect(comHeader.payload.total).toBe(3);

      const porQuery = await search("/ads?key=segredo-radar");
      expect(porQuery.status).toBe(200);
    } finally {
      clearRadarKeys();
    }
  });
});
