import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { radarDb } from "@/lib/radar/db";
import { fetchBingAds, guessLanguage, toIncomingBing } from "@/lib/radar/sources/bing";
import { insightsEnabled, latestInsights, recordSyncInsight } from "@/lib/radar/insights";
import { runSyncNotifying } from "@/lib/radar/sync-alerts";
import { cleanupTestDatabase, seedRadarFixtures, useTestDatabase } from "./helpers";

const dbFile = useTestDatabase();

const BING_AD = {
  AdId: 71056221548107,
  AdvertiserName: "Promovacances",
  AdvertiserId: 4295000301,
  Title: "Vacances en Grèce : séjours tout compris",
  Description: "Découvrez les îles grecques avec nos offres tout compris. Vol + Hôtel inclus !",
  DisplayUrl: "www.promovacances.com",
  DestinationUrl: "https://www.promovacances.com/vacances-sejour-hotel/voyage-grece/",
  AssetJson: JSON.stringify([{ AssetType: "Video", AssetUrl: "https://cdn.example/video.mp4" }]),
};

beforeEach(() => {
  seedRadarFixtures();
  radarDb().exec("DELETE FROM radar_sync_insights; DELETE FROM radar_alerts; DELETE FROM radar_alert_sends; DELETE FROM radar_syncs;");
  delete process.env.RADAR_INSIGHTS;
  delete process.env.RADAR_INSIGHTS_ADS;
  delete process.env.RADAR_BING_ENABLED;
  delete process.env.BING_AD_LIBRARY_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.ZAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.RADAR_ALERT_WHATSAPP;
  delete process.env.RADAR_ALERT_EMAIL;
  vi.unstubAllGlobals();
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
  vi.unstubAllGlobals();
});

describe("Microsoft Ad Library", () => {
  it("converte o anúncio para o formato do Radar", () => {
    const ad = toIncomingBing(BING_AD, "2026-11-02");
    expect(ad).toMatchObject({
      external_id: "bing_71056221548107",
      source: "bing",
      advertiser: "Promovacances",
      advertiser_id: "4295000301",
      network: "microsoft",
      start_date: "2026-11-02",
      media_type: "video",
      headline: "Vacances en Grèce : séjours tout compris",
      landing_domain: "promovacances.com",
      landing_url: "https://www.promovacances.com/vacances-sejour-hotel/voyage-grece/",
    });
    expect(ad?.body).toContain("îles grecques");
  });

  it("não marca como português um anúncio escrito em outra língua", () => {
    expect(toIncomingBing(BING_AD)?.language).toBe("fr");
    expect(
      guessLanguage("Descubra as ilhas gregas com nossas ofertas tudo incluído. Voo + hotel para você e sua família"),
    ).toBe("pt");
    expect(guessLanguage("Sichern Sie sich jetzt Ihre Reise mit Flug und Hotel für Ihre Familie")).toBe("de");
    expect(guessLanguage("ZXCV")).toBe("und");
  });

  it("descarta registro sem anunciante ou sem texto", () => {
    expect(toIncomingBing({ ...BING_AD, AdvertiserName: " " })).toBeNull();
    expect(toIncomingBing({ ...BING_AD, Description: null, Title: null })).toBeNull();
  });

  it("puxa as páginas da API aberta e desduplica por AdId", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        // primeira página cheia (2 de 2) força a segunda; lá vem um repetido e um novo
        const value = calls.length === 1 ? [BING_AD, BING_AD] : [BING_AD, { ...BING_AD, AdId: 71056221548108 }];
        return { ok: true, status: 200, json: async () => ({ value }) };
      }),
    );

    const ads = await fetchBingAds({ pages: 2, limit: 2 });
    expect(ads.map((ad) => ad.external_id)).toEqual(["bing_71056221548107", "bing_71056221548108"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("$top=2&$skip=0");
    expect(calls[1]).toContain("$skip=2");
  });

  it("transforma erro da API em mensagem legível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: "Requested value 'PT' was not found." }) })),
    );
    await expect(fetchBingAds()).rejects.toThrow("Microsoft Ad Library respondeu: Requested value 'PT' was not found.");
  });
});

describe("leitura por IA da sincronização", () => {
  it("sem chave de IA grava resumo local marcado como simulação", async () => {
    expect(insightsEnabled()).toBe(true);

    const insight = await recordSyncInsight({ source: "bing", inserted: 3, updated: 0 });
    expect(insight).not.toBeNull();
    expect(insight).toMatchObject({ source: "bing", ads: 3, model: "simulador local", simulated: 1 });
    expect(insight!.text).toContain("Microsoft Ad Library: 3 anúncio(s) novo(s)");
    expect(insight!.text).toContain("configure AI_API_KEY");
    expect(latestInsights()).toHaveLength(1);
  });

  it("não gera leitura quando nada entrou", async () => {
    expect(await recordSyncInsight({ source: "bing", inserted: 0, updated: 0 })).toBeNull();
    expect(latestInsights()).toHaveLength(0);
  });

  it("RADAR_INSIGHTS=off desliga a leitura", async () => {
    process.env.RADAR_INSIGHTS = "off";
    expect(insightsEnabled()).toBe(false);
    expect(await recordSyncInsight({ source: "bing", inserted: 5, updated: 1 })).toBeNull();
    expect(latestInsights()).toHaveLength(0);
  });

  it("a sincronização que traz anúncio novo já deixa a leitura gravada", async () => {
    const { result } = await runSyncNotifying("sandbox");
    expect(result.status).toBe("ok");
    expect(result.inserted).toBeGreaterThan(0);

    const [insight] = latestInsights(1, "sandbox");
    expect(insight).toMatchObject({ source: "sandbox", simulated: 1 });
    expect(insight.text).toContain("Base de demonstração");
  });
});
