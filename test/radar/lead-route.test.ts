import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/radar/lead/route";
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

type LeadPayload = { leadId?: number; score?: number; created?: boolean; inbox?: string; error?: string };

async function createLead(body: unknown, headers: Record<string, string> = {}) {
  const response = await POST(postRequest("/lead", body, headers));
  return { status: response.status, payload: (await response.json()) as LeadPayload };
}

function leadByPhone(phone: string) {
  return getDb()
    .prepare("SELECT id, name, phone, vertical, stage, score, source, city FROM leads WHERE phone = ?")
    .get(phone) as
    | { id: number; name: string; phone: string; vertical: string; stage: string; score: number; source: string; city: string | null }
    | undefined;
}

function originsFor(leadId: number) {
  return getDb()
    .prepare("SELECT lead_id, ad_id, collection_id FROM radar_lead_origins WHERE lead_id = ?")
    .all(leadId) as { lead_id: number; ad_id: number; collection_id: number | null }[];
}

beforeAll(() => {
  fixtures = seedRadarFixtures();
  clearRadarKeys();
});

afterAll(() => {
  cleanupTestDatabase(dbFile);
});

describe("POST /api/radar/lead", () => {
  it("cria o lead no funil e registra a prancha de origem", async () => {
    const { status, payload } = await createLead({
      adId: fixtures.bella,
      collectionId: fixtures.atacado,
      name: "Maria Souza",
      phone: "+55 62 99999-0001",
      vertical: "moda-varejo",
      city: "Goiânia",
    });

    expect(status).toBe(201);
    expect(payload.created).toBe(true);
    expect(payload.inbox).toBe(`/inbox?lead=${payload.leadId}`);
    expect(payload.score).toBeGreaterThanOrEqual(0);

    const lead = leadByPhone("5562999990001");
    expect(lead).toBeDefined();
    expect(lead).toMatchObject({
      id: payload.leadId,
      name: "Maria Souza",
      phone: "5562999990001",
      vertical: "moda-varejo",
      source: `Radar · ${fixtures.atacadoName}`,
      city: "Goiânia",
    });

    expect(originsFor(payload.leadId!)).toEqual([
      { lead_id: payload.leadId, ad_id: fixtures.bella, collection_id: fixtures.atacado },
    ]);

    const event = getDb()
      .prepare("SELECT type, detail FROM events WHERE lead_id = ? AND type = 'radar.lead'")
      .get(payload.leadId!) as { type: string; detail: string } | undefined;
    expect(event?.detail).toContain(`Lead criado da prancha "${fixtures.atacadoName}"`);
    expect(event?.detail).toContain("(test-bella-1)");
  });

  it("reaproveita o lead existente quando o telefone já está na base", async () => {
    const { status, payload } = await createLead({
      adId: fixtures.bella,
      collectionId: fixtures.atacado,
      name: "Maria Souza",
      phone: "62 9 9999-0001",
      vertical: "moda-varejo",
    });

    expect(status).toBe(200);
    expect(payload.created).toBe(false);

    const lead = leadByPhone("5562999990001");
    expect(lead?.id).toBe(payload.leadId);

    const duplicates = getDb()
      .prepare("SELECT COUNT(*) AS n FROM leads WHERE phone = ?")
      .get("5562999990001") as { n: number };
    expect(duplicates.n).toBe(1);

    expect(originsFor(payload.leadId!)).toHaveLength(1);
  });

  it("recusa anúncio que não está na prancha", async () => {
    const { status, payload } = await createLead({
      adId: fixtures.sono,
      collectionId: fixtures.atacado,
      name: "João Lima",
      phone: "+55 62 98888-0002",
      vertical: "moda-varejo",
    });

    expect(status).toBe(400);
    expect(payload.error).toBe("este anúncio não está na prancha");
    expect(leadByPhone("5562988880002")).toBeUndefined();
  });

  it("exige adId, collectionId, nome, telefone e nicho", async () => {
    const semIds = await createLead({ name: "Sem Ids", phone: "+55 62 97777-0003", vertical: "moda-varejo" });
    expect(semIds.status).toBe(400);
    expect(semIds.payload.error).toBe("adId e collectionId são obrigatórios");

    const semContato = await createLead({ adId: fixtures.bella, collectionId: fixtures.atacado, name: "Sem Contato" });
    expect(semContato.status).toBe(400);
    expect(semContato.payload.error).toBe("name, phone e vertical são obrigatórios");
  });

  it("rejeita JSON inválido", async () => {
    const { status, payload } = await createLead("telefone=11999999999");

    expect(status).toBe(400);
    expect(payload.error).toBe("JSON inválido");
  });

  it("exige x-api-key quando a chave está configurada", async () => {
    process.env.INTAKE_API_KEY = "segredo-lead";
    try {
      const semChave = await createLead({
        adId: fixtures.bella,
        collectionId: fixtures.atacado,
        name: "Sem Chave",
        phone: "+55 62 96666-0004",
        vertical: "moda-varejo",
      });
      expect(semChave.status).toBe(401);

      const comChave = await createLead(
        {
          adId: fixtures.bella,
          collectionId: fixtures.atacado,
          name: "Com Chave",
          phone: "+55 62 96666-0004",
          vertical: "moda-varejo",
        },
        { "x-api-key": "segredo-lead" },
      );
      expect(comChave.status).toBe(201);
    } finally {
      clearRadarKeys();
    }
  });
});
