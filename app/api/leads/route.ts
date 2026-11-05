import { NextResponse } from "next/server";
import { ingestLead, startCadence } from "@/lib/ingest";
import { VERTICALS, verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/leads",
    description:
      "Cria um lead qualificado e dispara a abertura da cadência do nicho. Aceita um lead por requisição.",
    auth: "Opcional: header x-api-key quando INTAKE_API_KEY estiver definida.",
    body: {
      name: "string (obrigatório)",
      phone: "string E.164 ou local (obrigatório)",
      vertical: `um de: ${VERTICALS.map((vertical) => vertical.slug).join(", ")}`,
      source: "string (opcional, ex.: Instagram Ads)",
      city: "string (opcional)",
      value: "number (opcional, valor potencial)",
      answers: "objeto com as respostas de qualificação (opcional)",
    },
    example: {
      name: "Bruna Almeida",
      phone: "+5511987654321",
      vertical: "moda-atacado",
      source: "Instagram",
      city: "São Paulo",
      value: 2400,
      answers: { volume: "Acima de 100 peças" },
    },
  });
}

export async function POST(request: Request) {
  const expectedKey = process.env.INTAKE_API_KEY;
  if (expectedKey && request.headers.get("x-api-key") !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const phone = String(payload.phone ?? "").trim();
  const verticalSlug = String(payload.vertical ?? "");
  const vertical = verticalBySlug(verticalSlug);

  if (!name || !phone) {
    return NextResponse.json({ error: "name e phone são obrigatórios" }, { status: 422 });
  }
  if (!vertical) {
    return NextResponse.json(
      { error: "vertical inválido", allowed: VERTICALS.map((item) => item.slug) },
      { status: 422 },
    );
  }

  const answers =
    payload.answers && typeof payload.answers === "object"
      ? Object.fromEntries(
          Object.entries(payload.answers as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
        )
      : {};

  const result = ingestLead({
    name,
    phone,
    vertical: vertical.slug,
    source: String(payload.source ?? "API"),
    city: payload.city ? String(payload.city) : undefined,
    value: payload.value ? Number(payload.value) : undefined,
    email: payload.email ? String(payload.email) : undefined,
    answers,
  });

  if (result.created) {
    await startCadence(result.id, phone, vertical.slug, name);
  }

  return NextResponse.json(
    {
      id: result.id,
      score: result.score,
      created: result.created,
      vertical: vertical.slug,
      conversationUrl: `/inbox?lead=${result.id}`,
    },
    { status: result.created ? 201 : 200 },
  );
}
