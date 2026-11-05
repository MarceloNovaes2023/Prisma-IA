import { NextResponse, type NextRequest } from "next/server";
import { createLeadFromBoard } from "@/lib/radar/funnel";

export const dynamic = "force-dynamic";

/**
 * Cria um lead a partir de um anúncio salvo numa prancha.
 * Mesma regra da interface: telefone existente é reaproveitado, nunca duplicado.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.RADAR_API_KEY?.trim() || process.env.INTAKE_API_KEY?.trim();
  if (expected) {
    const provided = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("key");
    if (provided !== expected) {
      return NextResponse.json({ error: "unauthorized", hint: "envie o header x-api-key" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const adId = Number(body.adId);
  const collectionId = Number(body.collectionId);
  const name = typeof body.name === "string" ? body.name : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const vertical = typeof body.vertical === "string" ? body.vertical : "";

  if (!Number.isFinite(adId) || adId <= 0 || !Number.isFinite(collectionId) || collectionId <= 0) {
    return NextResponse.json({ error: "adId e collectionId são obrigatórios" }, { status: 400 });
  }
  if (!name.trim() || !phone.trim() || !vertical.trim()) {
    return NextResponse.json({ error: "name, phone e vertical são obrigatórios" }, { status: 400 });
  }

  const result = createLeadFromBoard({
    adId,
    collectionId,
    name,
    phone,
    vertical,
    city: typeof body.city === "string" ? body.city : "",
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(
    { leadId: result.leadId, score: result.score, created: result.created, inbox: `/inbox?lead=${result.leadId}` },
    { status: result.created ? 201 : 200, headers: { "cache-control": "no-store" } },
  );
}
