import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, CheckCircle2, CreditCard, Link2, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, PageHeader, SectionHeader, Stat } from "@/components/ui";
import { confirmPaymentAction, createChargeAction } from "@/lib/actions";
import { brl, dateTime, relativeTime } from "@/lib/format";
import { listLeads } from "@/lib/queries";
import { getPaymentProvider, listPayments } from "@/lib/payments";
import { verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

const statusTone = (status: string) =>
  status === "paid" ? "lime" : status === "pending" ? "amber" : status === "refunded" ? "violet" : "neutral";

const statusLabel: Record<string, string> = {
  pending: "Aguardando",
  paid: "Pago",
  expired: "Expirado",
  refunded: "Estornado",
};

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const params = await searchParams;
  const head = await headers();
  const host = head.get("host") ?? "localhost:3100";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const payments = listPayments();
  const provider = getPaymentProvider();
  const leads = listLeads({ limit: 120 }).filter(
    (lead) => !["fechado", "perdido", "entregue", "vendido", "ativo", "onboarding", "recompra", "retorno"].includes(lead.stage),
  );

  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((acc, p) => acc + p.amount, 0);
  const paidTotal = payments.filter((p) => p.status === "paid").reduce((acc, p) => acc + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const conversion = payments.length ? (paidCount / payments.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Recebimento"
        title="Pagamentos"
        description="Cobre por PIX ou cartão, confirme o pagamento e o pedido é liberado automaticamente — com mensagem no WhatsApp e cashback calculado."
        actions={
          <Badge tone={provider.mode === "mercadopago" ? "lime" : "amber"} dot>
            {provider.mode === "mercadopago" ? "Mercado Pago conectado" : "Sandbox de pagamento"}
          </Badge>
        }
      />

      {params.novo && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lime/30 bg-lime/[0.06] px-4 py-2.5">
          <CheckCircle2 size={14} className="text-lime" />
          <p className="text-[12px]">
            Cobrança <span className="font-semibold">{params.novo}</span> criada e enviada no WhatsApp do cliente.
          </p>
          <Link href={`/pagar/${params.novo}`} className="btn ml-auto h-7 px-2 text-[10.5px]">
            Abrir checkout <ArrowRight size={11} />
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="A receber"
          value={brl(pendingTotal, true)}
          hint={`${payments.filter((p) => p.status === "pending").length} ${
            payments.filter((p) => p.status === "pending").length === 1 ? "cobrança aberta" : "cobranças abertas"
          }`}
          tone="amber"
          icon={<QrCode size={14} />}
        />
        <Stat label="Recebido" value={brl(paidTotal, true)} hint={`${paidCount} pagamentos confirmados`} tone="lime" icon={<Wallet size={14} />} />
        <Stat label="Ticket médio" value={brl(paidCount ? paidTotal / paidCount : 0, true)} hint="Média das cobranças pagas" tone="cyan" icon={<CreditCard size={14} />} />
        <Stat label="Conversão" value={`${conversion.toFixed(0)}%`} hint="Pagas ÷ cobranças emitidas" tone="violet" icon={<ShieldCheck size={14} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <SectionHeader title="Gerar cobrança" hint="O link vai por WhatsApp na hora" />
          <form action={createChargeAction} className="space-y-2.5">
            <div>
              <label className="label">Cliente</label>
              <select name="leadId" required className="select">
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} · {verticalBySlug(lead.vertical)?.short}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Valor (R$)</label>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  defaultValue={leads[0]?.value || 250}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Método</label>
                <select name="method" className="select">
                  <option value="pix">PIX</option>
                  <option value="card">Cartão (link)</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Descrição</label>
              <input name="description" className="input" defaultValue="Pedido" placeholder="Ex.: Pedido 12 peças" />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              <Link2 size={13} /> Criar cobrança e enviar
            </button>
            <p className="text-[10px] leading-relaxed text-dim">
              {provider.mode === "mercadopago"
                ? "O PIX real é gerado no Mercado Pago; a confirmação chega pelo webhook."
                : "Em sandbox o BR Code é gerado localmente e o pagamento é simulado no checkout."}
            </p>
          </form>
        </Card>

        <Card className="xl:col-span-8" padded={false}>
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <SectionHeader title="Cobranças" hint="Clique no código para abrir o checkout público" />
            <Badge tone="neutral">{payments.length}</Badge>
          </div>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-5 py-2 font-medium">Cobrança</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const vertical = verticalBySlug(payment.vertical);
                  return (
                    <tr key={payment.id} className="border-b border-line-soft last:border-0 hover:bg-[#101923]">
                      <td className="px-5 py-2">
                        <Link href={`/pagar/${payment.code}`} className="text-[11.5px] font-medium hover:text-lime">
                          {payment.code}
                        </Link>
                        <p className="text-[10px] text-dim">{relativeTime(payment.created_at)}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="line-clamp-1 max-w-[150px] text-[11.5px]">{payment.lead_name}</p>
                        <p className="text-[10px] text-dim">{vertical?.short}</p>
                      </td>
                      <td className="px-3 py-2 text-[11px] uppercase text-muted">{payment.method}</td>
                      <td className="px-3 py-2 text-right text-[11.5px] tabular-nums">{brl(payment.amount)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={statusTone(payment.status)} dot>
                          {statusLabel[payment.status] ?? payment.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-2 text-right">
                        {payment.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <CopyButton value={payment.pix_code ?? ""} label="PIX" />
                            <form action={confirmPaymentAction}>
                              <input type="hidden" name="code" value={payment.code} />
                              <button className="btn h-7 px-2 text-[10.5px]" type="submit">
                                Confirmar
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-dim">
                            {payment.paid_at ? dateTime(payment.paid_at) : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payments.length === 0 && (
            <p className="px-5 py-10 text-center text-[12px] text-dim">Nenhuma cobrança emitida ainda.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <SectionHeader title="Webhook de pagamento" hint="A confirmação real vem por aqui" />
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
              {baseUrl}/api/webhooks/payments
            </code>
            <CopyButton value={`${baseUrl}/api/webhooks/payments`} />
          </div>
          <p className="text-[10.5px] leading-relaxed text-dim">
            Configure como <code className="text-muted">notification_url</code> no Mercado Pago. O endpoint consulta o
            pagamento, e só com status <code className="text-muted">approved</code> libera o pedido e dispara o
            WhatsApp.
          </p>
        </Card>

        <Card className="space-y-2">
          <SectionHeader title="O que acontece quando o PIX cai" />
          <ol className="space-y-1.5 text-[11px] leading-relaxed text-dim">
            <li>
              <span className="text-fg">1.</span> O pedido é criado em <span className="text-fg">separação</span> (ou
              retomado, se já existia).
            </li>
            <li>
              <span className="text-fg">2.</span> O cashback do nicho é calculado sobre o valor pago e fica pendente
              até a entrega.
            </li>
            <li>
              <span className="text-fg">3.</span> O cliente recebe a confirmação no WhatsApp com valor, pedido e
              cashback.
            </li>
            <li>
              <span className="text-fg">4.</span> A etapa do lead avança para pedido pago quando o nicho tem essa
              etapa.
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
