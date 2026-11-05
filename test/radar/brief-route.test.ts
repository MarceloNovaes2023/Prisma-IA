import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/radar/brief/route";
import { getDb } from "@/lib/db";
import {
  clearRadarKeys,
  cleanupTestDatabase,
  postRequest,
  seedRadarFixtures,
  useTestDatabase,
  type RadarFixtures,
} from "./helpers";

const dbFile = useTestDatabase();
let fixtures: RadarFixtures;

type BriefPayload = { briefId?: number; ad?: string; error?: string };

async function save(body: unknown, headers: Record<string, string> = {}) {
  const response = await POST(postRequest("/brief", body, headers));
  return { status: response.status, payload: (await response.json()) as BriefPayload };
}

function briefsFor(adId: number) {
  return getDb()
    .prepare("SELECT id, ad_id, collection_id, title, text, model, simulated FROM radar_briefs WHERE ad_id = ? ORDER BY id ASC")
    .all(adId) as {
    id: number;
    ad_id: number;
    collection_id: number | null;
    title: string;
    text: string;
    model: string;
    simulated: number;
  }[];
}

beforeAll(() => {
  fixtures = seedRadarFixtures();
  clearRadarKeys();
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("POST /api/radar/brief", () => {
  it("salva o briefing ligado ao anúncio e à prancha", async () => {
    const { status, payload } = await save({
      adId: fixtures.bella,
      collectionId: fixtures.atacado,
      text: "# Briefing\n\n## Gancho\nProva concreta de 12 peças por R$ 349.",
      model: "local",
      simulated: true,
    });

    expect(status).toBe(201);
    expect(payload.ad).toBe(`/radar/anuncio/${fixtures.bella}`);
    expect(typeof payload.briefId).toBe("number");

    const [row] = briefsFor(fixtures.bella);
    expect(row).toMatchObject({
      id: payload.briefId,
      ad_id: fixtures.bella,
      collection_id: fixtures.atacado,
      text: "# Briefing\n\n## Gancho\nProva concreta de 12 peças por R$ 349.",
      model: "local",
      simulated: 1,
    });
    expect(row?.title).toBe("Briefing · Atacado Bella Moda — Coleção verão em atacado com 18% OFF");
  });

  it("aceita briefing sem prancha e usa modelo local por padrão", async () => {
    const { status, payload } = await save({ adId: fixtures.sono, text: "Briefing solto da campanha." });

    expect(status).toBe(201);

    const rows = briefsFor(fixtures.sono);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ collection_id: null, model: "local", simulated: 0 });
  });

  it("rejeita JSON inválido", async () => {
    const { status, payload } = await save("{isso não é json");

    expect(status).toBe(400);
    expect(payload.error).toBe("JSON inválido");
  });

  it("exige adId e text", async () => {
    const semAd = await save({ text: "sem anúncio" });
    expect(semAd.status).toBe(400);
    expect(semAd.payload.error).toBe("adId é obrigatório");

    const adInvalido = await save({ adId: -3, text: "anúncio inválido" });
    expect(adInvalido.status).toBe(400);

    const semTexto = await save({ adId: fixtures.bella, text: "   " });
    expect(semTexto.status).toBe(400);
    expect(semTexto.payload.error).toBe("text é obrigatório");
  });

  it("responde 404 quando o anúncio não existe", async () => {
    const { status, payload } = await save({ adId: 999_999, text: "briefing órfão" });

    expect(status).toBe(404);
    expect(payload.error).toBe("anúncio não encontrado");
  });

  it("recusa uma prancha inexistente", async () => {
    const { status, payload } = await save({
      adId: fixtures.bella,
      collectionId: 999_999,
      text: "briefing em prancha que não existe",
    });

    expect(status).toBe(400);
    expect(payload.error).toBe("coleção não encontrada");
  });

  it("exige x-api-key quando a chave está configurada", async () => {
    process.env.RADAR_API_KEY = "segredo-brief";
    try {
      const semChave = await save({ adId: fixtures.bella, text: "sem chave" });
      expect(semChave.status).toBe(401);

      const comChave = await save({ adId: fixtures.bella, text: "com chave" }, { "x-api-key": "segredo-brief" });
      expect(comChave.status).toBe(201);
    } finally {
      clearRadarKeys();
    }
  });
});
