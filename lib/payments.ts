import { getDb } from "./db";
import { nowStamp } from "./format";
import { sandboxPix } from "./pix";
import { sendWhatsAppText } from "./whatsapp";
import { verticalBySlug } from "./verticals";

export type PaymentMethod = "pix" | "card" | "boleto";
export type PaymentStatus = "pending" | "paid" | "expired" | "refunded";

export type Payment = {
  id: number;
  code: string;
  lead_id: number;
  order_id: number | null;
  provider: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  external_id: string | null;
  pix_code: string | null;
  checkout_url: string | null;
  description: string;
  created_at: string;
  paid_at: string | null;
};

export type PaymentProvider = {
  mode: "mercadopago" | "sandbox";
  name: string;
};

export function getPaymentProvider(): PaymentProvider {
  if (process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return { mode: "mercadopago", name: "Mercado Pago" };
  }
  return { mode: "sandbox", name: "Sandbox" };
}

export function generateCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `PAY-${stamp}${random}`;
}

type CreateChargeInput = {
  leadId: number;
  orderId?: number | null;
  amount: number;
  description: string;
  method: PaymentMethod;
  payerEmail?: string;
  leadName: string;
  checkoutBaseUrl: string;
};

export type CreateChargeResult = {
  payment: Payment;
  provider: "mercadopago" | "sandbox";
  warning?: string;
};

export async function createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const db = getDb();
  const provider = getPaymentProvider();
  const code = generateCode();
  const createdAt = nowStamp();
  const txid = code.replace(/-/g, "").slice(0, 20);

  let externalId: string | null = null;
  let pixCode: string | null = null;
  let checkoutUrl: string = `${input.checkoutBaseUrl}/pagar/${code}`;
  let providerName = provider.mode;
  let warning: string | undefined;

  if (provider.mode === "mercadopago") {
    try {
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": code,
        },
        body: JSON.stringify({
          transaction_amount: Number(input.amount.toFixed(2)),
          description: input.description,
          payment_method_id: input.method === "pix" ? "pix" : input.method,
          external_reference: code,
          notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || undefined,
          payer: {
            email: input.payerEmail || process.env.PIX_PAYER_FALLBACK_EMAIL || "cliente@fluxo.demo",
            first_name: input.leadName.split(" ")[0],
          },
        }),
      });

      const data = (await response.json()) as {
        id?: number | string;
        status?: string;
        point_of_interaction?: {
          transaction_data?: { qr_code?: string; ticket_url?: string };
        };
        message?: string;
      };

      if (!response.ok) {
        warning = data?.message ?? `Mercado Pago respondeu ${response.status}`;
      } else {
        externalId = data.id ? String(data.id) : null;
        pixCode = data.point_of_interaction?.transaction_data?.qr_code ?? null;
        checkoutUrl = data.point_of_interaction?.transaction_data?.ticket_url ?? checkoutUrl;
        providerName = "mercadopago";
      }
    } catch (error) {
      warning = (error as Error).message;
    }
  }

  if (!pixCode) {
    pixCode = sandboxPix({
      amount: input.amount,
      txid,
      description: input.description,
    });
  }

  const info = db
    .prepare(
      `INSERT INTO payments (code, lead_id, order_id, provider, method, amount, status, external_id, pix_code, checkout_url, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
    .run(
      code,
      input.leadId,
      input.orderId ?? null,
      providerName,
      input.method,
      input.amount,
      externalId,
      pixCode,
      checkoutUrl,
      input.description,
      createdAt,
    );

  const payment = getPayment(Number(info.lastInsertRowid))!;
  return { payment, provider: providerName === "mercadopago" ? "mercadopago" : "sandbox", warning };
}

export function getPayment(id: number): Payment | undefined {
  const row = getDb().prepare("SELECT * FROM payments WHERE id = ?").get(id) as Payment | undefined;
  return row ? { ...row } : undefined;
}

export function getPaymentByCode(code: string): Payment | undefined {
  const row = getDb().prepare("SELECT * FROM payments WHERE code = ?").get(code) as Payment | undefined;
  return row ? { ...row } : undefined;
}

export function listPayments(): (Payment & { lead_name: string; vertical: string })[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, l.name AS lead_name, l.vertical AS vertical
       FROM payments p JOIN leads l ON l.id = p.lead_id
       ORDER BY p.created_at DESC LIMIT 120`,
    )
    .all() as (Payment & { lead_name: string; vertical: string })[];
  return rows.map((row) => ({ ...row }));
}

/** Confirma o pagamento, cria/libera o pedido e avisa o cliente. */
export async function confirmPayment(code: string, source = "sandbox"): Promise<{ ok: boolean; message: string }> {
  const payment = getPaymentByCode(code);
  if (!payment) return { ok: false, message: "Cobrança não encontrada" };
  if (payment.status === "paid") return { ok: false, message: "Cobrança já estava paga" };

  const db = getDb();
  const paidAt = nowStamp();
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?").run(paidAt, payment.id);

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(payment.lead_id) as
    | { id: number; name: string; phone: string; vertical: string; value: number }
    | undefined;
  if (!lead) return { ok: false, message: "Lead não encontrado" };

  const vertical = verticalBySlug(lead.vertical);
  const rule = vertical?.cashback;
  const cashback =
    rule?.kind === "percent"
      ? Math.round((payment.amount * rule.value) / 100)
      : rule?.kind === "fixed"
        ? rule.value
        : 0;

  let orderId = payment.order_id;
  if (!orderId) {
    const stamp = Date.now().toString(36).toUpperCase().slice(-4);
    const info = db
      .prepare(
        `INSERT INTO orders (lead_id, code, description, total, status, cashback, cashback_status, created_at)
         VALUES (?, ?, ?, ?, 'producao', ?, 'none', ?)`,
      )
      .run(
        lead.id,
        `PED-${stamp}`,
        payment.description,
        payment.amount,
        cashback,
        paidAt,
      );
    orderId = Number(info.lastInsertRowid);
    db.prepare("UPDATE payments SET order_id = ? WHERE id = ?").run(orderId, payment.id);
  } else {
    db.prepare("UPDATE orders SET status = 'producao', cashback = ?, cashback_status = 'none' WHERE id = ?").run(
      cashback,
      orderId,
    );
  }

  // a venda sai do "aguardando pagamento" e avança para a etapa de pedido pago, quando o nicho tem essa etapa
  const paidStage = vertical?.stages.find((stage) => stage.key === "pago" || stage.key === "pedido");
  if (paidStage) {
    db.prepare("UPDATE leads SET stage = ? WHERE id = ? AND stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno')").run(
      paidStage.key,
      lead.id,
    );
  }

  db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'payment.paid', ?, ?)").run(
    lead.id,
    `Pagamento ${payment.code} confirmado (${source}) · ${formatBrl(payment.amount)}`,
    paidAt,
  );

  const confirmation =
    `Pagamento confirmado ✅\n` +
    `Pedido ${orderId ? `#${orderId}` : ""} no valor de ${formatBrl(payment.amount)} liberado.\n` +
    (cashback > 0 ? `Você acumulou ${formatBrl(cashback)} de cashback para usar na próxima compra.` : "") +
    `\nJá iniciamos a separação e te aviso quando sair para entrega.`;

  const sent = await sendWhatsAppText(lead.phone, confirmation);
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, author, created_at) VALUES (?, 'out', ?, ?, 'pagamento', ?, 'system', ?)",
  ).run(lead.id, confirmation, sent.ok ? "delivered" : "failed", sent.providerId ?? null, paidAt);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(paidAt, lead.id);

  return { ok: true, message: "Pagamento confirmado e pedido liberado" };
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
