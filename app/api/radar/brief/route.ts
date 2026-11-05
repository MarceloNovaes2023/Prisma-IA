import { NextResponse, type NextRequest } from "next/server";
import { saveBrief } from "@/lib/radar/funnel";
import { listCollections } from "@/lib/radar/track";

export const dynamic = "force-dynamic";

/**
 * Guarda um briefing de campanha ligado ao anúncio (e opcionalmente à prancha).
 * Mesma função usada pelo botão "Salvar briefing" na página do anúncio.
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
  const text = typeof body.text === "string" ? body.text : "";
  const collectionId = Number(body.collectionId) || null;

  if (!Number.isFinite(adId) || adId <= 0) {
    return NextResponse.json({ error: "adId é obrigatório" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
  }
  if (collectionId && !listCollections().some((board) => board.id === collectionId)) {
    return NextResponse.json({ error: "coleção não encontrada" }, { status: 400 });
  }

  const briefId = saveBrief({
    adId,
    collectionId,
    text,
    model: typeof body.model === "string" ? body.model : "local",
    simulated: body.simulated === true || body.simulated === "1",
  });

  if (!briefId) return NextResponse.json({ error: "anúncio não encontrado" }, { status: 404 });

  return NextResponse.json(
    { briefId, ad: `/radar/anuncio/${adId}` },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
