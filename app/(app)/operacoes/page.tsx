import Link from "next/link";
import { ArrowRight, Package, PackageCheck, RotateCcw, Truck, Wallet } from "lucide-react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { advanceOrderAction, redeemCashbackAction } from "@/lib/actions";
import { brl, dateTime, relativeTime } from "@/lib/format";
import { getOrders } from "@/lib/queries";
import { verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

const statusTone = (status: string) =>
  status === "entregue" ? "lime" : status === "enviado" ? "cyan" : status === "aguardando" ? "rose" : "amber";

const statusLabel: Record<string, string> = {
  aguardando: "Aguardando pagamento",
  producao: "Em separação",
  enviado: "Em trânsito",
  entregue: "Entregue",
};

export default async function OperacoesPage() {
  const orders = getOrders();
  const active = orders.filter((order) => order.status !== "entregue");
  const delivered = orders.filter((order) => order.status === "entregue");
  const cashbackTotal = orders.reduce((acc, order) => acc + order.cashback, 0);
  const cashbackOpen = orders
    .filter((order) => order.cashback_status === "credited")
    .reduce((acc, order) => acc + order.cashback, 0);
  const cashbackRedeemed = orders
    .filter((order) => order.cashback_status === "redeemed")
    .reduce((acc, order) => acc + order.cashback, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Pós-venda"
        title="Pedidos, logística e cashback"
        description="Cada mudança de status dispara mensagem no WhatsApp e libera o cashback no momento da entrega."
        actions={
          <Link href="/automacoes" className="btn">
            Ver cadências <ArrowRight size={13} />
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pedidos ativos" value={String(active.length)} hint="Separação e trânsito" tone="amber" icon={<Package size={14} />} />
        <Stat label="Entregues" value={String(delivered.length)} hint="Base de recompra" tone="lime" icon={<PackageCheck size={14} />} />
        <Stat label="Cashback gerado" value={brl(cashbackTotal, true)} hint={`${brl(cashbackRedeemed, true)} já resgatado`} tone="violet" icon={<Wallet size={14} />} />
        <Stat label="Cashback disponível" value={brl(cashbackOpen, true)} hint="Crédito aguardando uso" tone="cyan" icon={<RotateCcw size={14} />} />
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[13px] font-semibold">Pedidos & logística</h2>
            <p className="text-[11.5px] text-dim">
              Avance o status: separação → trânsito → entregue. A entrega libera o cashback automaticamente.
            </p>
          </div>
          <Badge tone="neutral">{orders.length} pedidos</Badge>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                <th className="px-5 py-2 font-medium">Pedido</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Nicho</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rastreio</th>
                <th className="px-3 py-2 text-right font-medium">Cashback</th>
                <th className="px-5 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const vertical = verticalBySlug(order.vertical);
                return (
                  <tr key={order.id} className="border-b border-line-soft last:border-0 hover:bg-[#101923]">
                    <td className="px-5 py-2">
                      <p className="text-[12px] font-medium">{order.code}</p>
                      <p className="line-clamp-1 max-w-[190px] text-[10px] text-dim">{order.description}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/inbox?lead=${order.lead_id}`} className="text-[11.5px] hover:text-lime">
                        {order.lead_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="size-1.5 rounded-full" style={{ background: vertical?.color }} />
                        {vertical?.short}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[11.5px] tabular-nums">{brl(order.total)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(order.status)} dot>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {order.tracking ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
                          <Truck size={11} /> {order.carrier}
                          <span className="ml-1 font-mono text-[10px] text-dim">{order.tracking}</span>
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-dim">aguardando coleta</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {order.cashback > 0 ? (
                        <span className="text-[11.5px] tabular-nums text-lime">{brl(order.cashback)}</span>
                      ) : (
                        <span className="text-[10.5px] text-dim">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right">
                      {order.status !== "entregue" ? (
                        <form action={advanceOrderAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <button className="btn h-6 px-2 text-[10.5px]" type="submit">
                            Avançar
                          </button>
                        </form>
                      ) : order.cashback_status === "credited" ? (
                        <form action={redeemCashbackAction}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <button className="btn h-6 px-2 text-[10.5px]" type="submit">
                            Resgatar
                          </button>
                        </form>
                      ) : (
                        <span className="text-[10.5px] text-dim">
                          {order.cashback_status === "redeemed" ? "resgatado" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <p className="px-5 py-10 text-center text-[12px] text-dim">Nenhum pedido registrado.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-[12px] font-semibold">Regras de cashback ativas</h2>
          <div className="mt-2 space-y-2">
            {Object.entries(
              getOrders()
                .reduce<Record<string, number>>((acc, order) => {
                  if (order.cashback > 0) acc[order.vertical] = (acc[order.vertical] ?? 0) + order.cashback;
                  return acc;
                }, {}),
            ).map(([slug, value]) => {
              const vertical = verticalBySlug(slug);
              return (
                <div key={slug} className="flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-1.5 rounded-full" style={{ background: vertical?.color }} />
                    {vertical?.short}
                  </span>
                  <span className="tabular-nums">{brl(value, true)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 border-t border-line-soft pt-2 text-[10px] leading-relaxed text-dim">
            Advocacia e contabilidade não usam cashback: OAB e CFC vedam vantagem financeira por captação.
          </p>
        </Card>

        <Card>
          <h2 className="text-[12px] font-semibold">Últimas entregas</h2>
          <div className="mt-2 space-y-1.5">
            {delivered.slice(0, 6).map((order) => (
              <div key={order.id} className="flex items-center justify-between text-[11px]">
                <span className="truncate text-muted">{order.lead_name}</span>
                <span className="shrink-0 text-[10px] text-dim">{relativeTime(order.delivered_at)}</span>
              </div>
            ))}
            {delivered.length === 0 && <p className="text-[11px] text-dim">Nenhuma entrega concluída.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="text-[12px] font-semibold">Mensagens automáticas</h2>
          <div className="mt-2 space-y-2 text-[10.5px] leading-relaxed text-dim">
            <p>
              <span className="chip mr-1">separação</span> “Oi {"{nome}"}, seu pedido entrou em separação. Te aviso
              quando sair para entrega.”
            </p>
            <p>
              <span className="chip mr-1">trânsito</span> “Saiu para entrega! Rastreio {"{codigo}"} pela {"{transportadora}"}.”
            </p>
            <p>
              <span className="chip mr-1">entregue</span> “Chegou! Você ganhou {"{cashback}"} de volta para usar em 90
              dias.”
            </p>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 py-3">
          <h2 className="text-[12px] font-semibold">Histórico de movimentação</h2>
        </div>
        <div className="border-t border-line">
          {orders.slice(0, 5).map((order) => (
            <div key={`hist-${order.id}`} className="flex items-center gap-2 border-b border-line-soft px-5 py-1.5 text-[11px] last:border-0">
              <Badge tone={statusTone(order.status)}>{statusLabel[order.status]}</Badge>
              <span className="text-muted">{order.code}</span>
              <span className="text-dim">{order.lead_name}</span>
              <span className="ml-auto text-[10px] text-dim">{dateTime(order.delivered_at ?? order.created_at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
