import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { maybeAutoReply } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { nowStamp } from "@/lib/format";
import { handleInbound } from "@/lib/ingest";
import { getProvider, parseInboundWebhook, sendWhatsAppText } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = getProvider().verifyToken;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "verificação recusada" }, { status: 403 });
}

function validSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // assinatura opcional até o app secret ser configurado
  if (!signature?.startsWith("sha256=")) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice(7);
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const url = new URL(request.url);
  const vertical = url.searchParams.get("vertical") ?? undefined;
  const messages = parseInboundWebhook(payload as Parameters<typeof parseInboundWebhook>[0]);
  const handled: { leadId: number; created: boolean }[] = [];

  for (const message of messages) {
    const result = await handleInbound({
      from: message.from,
      name: message.name,
      text: message.text,
      providerId: message.providerId,
      vertical,
    });
    handled.push(result);

    // A IA responde quando o lead está em modo automático; se não responder,
    // o primeiro contato recebe a saudação padrão do nicho.
    const ai = await maybeAutoReply(result.leadId);

    if (result.created && !ai.replied) {
      const greeting = renderTemplate(
        "Oi {primeiro_nome}! Recebemos sua mensagem. Já estou verificando e te respondo em instantes.",
        { primeiro_nome: message.name?.split(" ")[0] ?? "" },
      );
      const sent = await sendWhatsAppText(message.from, greeting);
      const db = getDb();
      const stamp = nowStamp();
      db.prepare(
        "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, author, created_at) VALUES (?, 'out', ?, ?, 'abertura', ?, 'system', ?)",
      ).run(result.leadId, greeting, sent.ok ? "delivered" : "failed", sent.providerId ?? null, stamp);
      db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(stamp, result.leadId);
    }
  }

  return NextResponse.json({ received: messages.length, handled });
}
