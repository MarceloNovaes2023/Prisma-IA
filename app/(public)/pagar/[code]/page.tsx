import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock3, Copy, Lock, QrCode, ShieldCheck, Zap } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { confirmPaymentAction } from "@/lib/actions";
import { brl, dateTime } from "@/lib/format";
import { getPaymentByCode } from "@/lib/payments";
import { sandboxPix } from "@/lib/pix";
import { getLead } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { getProvider } from "@/lib/whatsapp";
import { verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const payment = getPaymentByCode(code);
  if (!payment) notFound();

  const lead = getLead(payment.lead_id);
  const vertical = lead ? verticalBySlug(lead.vertical) : undefined;
  const whatsappMode = getProvider().mode;

  let pixCode = payment.pix_code;
  if (!pixCode) {
    pixCode = sandboxPix({ amount: payment.amount, txid: payment.code.replace(/-/g, "") });
    getDb().prepare("UPDATE payments SET pix_code = ? WHERE id = ?").run(pixCode, payment.id);
  }

  const paid = payment.status === "paid";
  const cashback =
    vertical?.cashback.kind === "percent"
      ? Math.round((payment.amount * vertical.cashback.value) / 100)
      : vertical?.cashback.kind === "fixed"
        ? vertical.cashback.value
        : 0;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-30"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${vertical?.color ?? "#a3f04b"}55, transparent 65%)` }}
      />
      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-lime text-lime-ink">
            <Zap size={13} strokeWidth={2.8} />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">PRISMA IA</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-dim">
          <Lock size={12} /> ambiente seguro
        </span>
      </header>

      <main className="relative mx-auto max-w-[520px] px-6 pb-16">
        <div className="rounded-2xl border border-line bg-[#0d1319] p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-dim">Cobrança {payment.code}</p>
              <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight">{brl(payment.amount)}</h1>
              <p className="mt-1.5 text-[12px] text-muted">{payment.description}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] ${
                paid
                  ? "border-lime/30 bg-lime/10 text-lime"
                  : "border-amber/30 bg-amber/10 text-amber"
              }`}
            >
              {paid ? <BadgeCheck size={11} /> : <Clock3 size={11} />}
              {paid ? "Pago" : "Aguardando pagamento"}
            </span>
          </div>

          {paid ? (
            <div className="mt-5 rounded-xl border border-lime/25 bg-lime/[0.05] p-4 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-lime/15 text-lime">
                <BadgeCheck size={20} />
              </span>
              <p className="mt-2 text-[15px] font-semibold">Pagamento confirmado</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                {payment.paid_at ? `Confirmado em ${dateTime(payment.paid_at)}. ` : ""}
                Seu pedido entrou em separação e a confirmação foi enviada no WhatsApp.
              </p>
              {cashback > 0 && (
                <p className="mt-2 text-[11.5px] text-lime">
                  Você acumulou {brl(cashback)} de cashback para a próxima compra.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-[#0b1219] px-3 py-2">
                <QrCode size={14} className="text-lime" />
                <p className="text-[11px] text-muted">
                  Pague com <span className="text-fg">PIX Copia e Cola</span> em qualquer banco
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-line bg-[#080d12] p-3">
                <p className="text-[9.5px] uppercase tracking-wider text-dim">Código PIX</p>
                <p className="mt-1 max-h-[92px] overflow-y-auto break-all font-mono text-[10px] leading-relaxed text-muted">
                  {pixCode}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <CopyButton value={pixCode} label="Copiar código" />
                  <span className="text-[10px] text-dim">expira em 30 minutos</span>
                </div>
              </div>

              <ol className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-dim">
                <li>1. Abra o app do seu banco e escolha PIX → Copia e Cola.</li>
                <li>2. Cole o código acima e confirme o valor de {brl(payment.amount)}.</li>
                <li>3. A liberação é automática assim que o banco confirmar.</li>
              </ol>

              {payment.provider === "sandbox" ? (
                <div className="mt-4 rounded-xl border border-dashed border-amber/30 bg-amber/[0.04] p-3">
                  <p className="text-[10.5px] leading-relaxed text-amber/90">
                    Ambiente de teste: este código não movimenta dinheiro. Use o botão abaixo para simular a
                    aprovação e ver a automação liberar o pedido.
                  </p>
                  <form action={confirmPaymentAction} className="mt-2">
                    <input type="hidden" name="code" value={payment.code} />
                    <button type="submit" className="btn w-full">
                      Simular pagamento aprovado
                    </button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-[10.5px] text-dim">
                  <ShieldCheck size={12} className="text-lime" />
                  Processado pelo Mercado Pago. A confirmação chega automaticamente.
                </div>
              )}
            </>
          )}

          <div className="mt-4 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-dim">
            Cliente: {lead?.name ?? "—"}
            {whatsappMode === "sandbox" && " · mensagens em modo sandbox"}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[10.5px] text-dim">
          <Link href="/pagamentos" className="hover:text-lime">
            Voltar ao painel
          </Link>
          <span className="inline-flex items-center gap-1">
            <Copy size={10} /> Guarde o código {payment.code}
          </span>
        </div>
      </main>
    </div>
  );
}
