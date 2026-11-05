import { NextResponse } from "next/server";
import { confirmPayment, getPaymentByCode } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago (PIX/cartão).
 * Aceita ?type=payment&data.id=123 e o corpo JSON { type, data: { id } }.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {
        type: String(form.get("topic") ?? form.get("type") ?? ""),
        data: { id: String(form.get("id") ?? form.get("data.id") ?? "") },
      };
    }
  } catch {
    body = {};
  }

  const paymentId = url.searchParams.get("data.id") ?? body?.data?.id;
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

  if (!paymentId) return NextResponse.json({ ok: true, skipped: "sem id de pagamento" });

  if (!token) {
    // sem credencial: aceita o evento e não altera nada
    return NextResponse.json({ ok: true, mode: "sandbox" });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = (await response.json()) as {
      status?: string;
      external_reference?: string;
    };

    if (payment.status !== "approved" || !payment.external_reference) {
      return NextResponse.json({ ok: true, status: payment.status ?? "ignorado" });
    }

    const local = getPaymentByCode(payment.external_reference);
    if (!local) return NextResponse.json({ ok: true, skipped: "cobrança não encontrada" });

    const result = await confirmPayment(local.code, "mercadopago");
    return NextResponse.json({ ok: result.ok, message: result.message });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/webhooks/payments",
    provider: "Mercado Pago",
    note: "Configure esta URL como notification_url na conta do Mercado Pago.",
  });
}
