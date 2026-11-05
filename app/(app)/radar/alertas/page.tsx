import Link from "next/link";
import { BellRing, CheckCheck, Circle, Mail, MessageCircle, Send } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { markAlertsReadAction, sendSourceAlertsAction } from "@/lib/radar/actions";
import {
  alertDestinations,
  deliveredSources,
  emailConfigured,
  lastDeliveries,
  pendingCounts,
  sourceDeliveries,
} from "@/lib/radar/notices";
import { sourceLabel } from "@/lib/radar/error-rate";
import { listAlerts, unreadAlerts } from "@/lib/radar/track";
import { getProvider } from "@/lib/whatsapp";
import { dateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND: Record<string, { label: string; tone: "lime" | "rose" | "amber" | "violet" }> = {
  new_ad: { label: "Anúncio novo", tone: "lime" },
  clone: { label: "Criativo copiado", tone: "rose" },
  new_winner: { label: "Entrou no radar", tone: "amber" },
  stopped: { label: "Anúncio encerrado", tone: "violet" },
  source_down: { label: "Fonte fora do ar", tone: "rose" },
  source_ok: { label: "Fonte recuperada", tone: "lime" },
  source_error_rate: { label: "Taxa de falha alta", tone: "amber" },
};

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ envio?: string; estado?: string; msg?: string; fonte?: string }>;
}) {
  const { envio, estado, msg, fonte } = await searchParams;
  const sources = deliveredSources();
  const deliveries = sourceDeliveries({ source: fonte, limit: 40 });
  const alerts = listAlerts(80);
  const unread = unreadAlerts();
  const pending = pendingCounts();
  const destinations = alertDestinations();
  const canEmail = emailConfigured();
  const provider = getProvider();
  const recent = lastDeliveries(4);

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <PageHeader
        eyebrow="Monitoramento"
        title="Alertas"
        description="A sincronização compara o que existe hoje com o que existia antes: anúncio novo, criativo copiado, entrada no radar de vencedores."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={unread > 0 ? "amber" : "neutral"} dot>
              {unread} não lido{unread === 1 ? "" : "s"}
            </Badge>
            {unread > 0 && (
              <form action={markAlertsReadAction}>
                <button className="btn h-8 text-[11.5px]" type="submit">
                  <CheckCheck size={12} /> Marcar todos como lidos
                </button>
              </form>
            )}
          </div>
        }
      />

      {envio && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-[11.5px] ${
            estado === "erro"
              ? "border-rose/30 bg-rose/[0.06] text-rose"
              : estado === "vazio"
                ? "border-amber/30 bg-amber/[0.06] text-amber"
                : "border-lime/30 bg-lime/[0.06] text-fg"
          }`}
        >
          {msg ?? "Envio concluído."}
        </div>
      )}

      <Card className="space-y-3">
        <SectionHeader
          title="Avisar o time"
          hint="Automático a cada sincronização quando a fonte cai ou volta; aqui você reenvia o que ficou pendente"
        />

        <div className="flex flex-wrap gap-2">
          <Badge tone={pending.whatsapp > 0 ? "amber" : "neutral"} dot>
            {pending.whatsapp} pendente(s) no WhatsApp
          </Badge>
          <Badge tone={pending.email > 0 ? "amber" : "neutral"} dot>
            {pending.email} pendente(s) no e-mail
          </Badge>
          <Badge tone={provider.mode === "cloud" ? "lime" : "cold"}>
            {provider.mode === "cloud" ? "WhatsApp Cloud API" : "WhatsApp em sandbox"}
          </Badge>
          <Badge tone={canEmail ? "lime" : "cold"}>{canEmail ? "E-mail via Resend" : "E-mail não configurado"}</Badge>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <form
            action={sendSourceAlertsAction}
            className="flex flex-col gap-2 rounded-lg border border-line-soft bg-[#0b1219] p-2.5"
          >
            <input type="hidden" name="channel" value="whatsapp" />
            <label>
              <span className="label">WhatsApp do responsável</span>
              <input
                name="to"
                defaultValue={destinations.whatsapp}
                placeholder="+55 11 90000-0000"
                className="input"
                required
              />
            </label>
            <button className="btn btn-primary h-8 w-full" type="submit">
              <MessageCircle size={12} /> Enviar por WhatsApp
            </button>
            <p className="text-[10px] leading-relaxed text-dim">
              {provider.mode === "cloud"
                ? `Envio pela Cloud API oficial a partir de ${provider.displayNumber}.`
                : "Sem WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID o envio fica em sandbox: é registrado no banco e nada sai da máquina."}
            </p>
          </form>

          <form
            action={sendSourceAlertsAction}
            className="flex flex-col gap-2 rounded-lg border border-line-soft bg-[#0b1219] p-2.5"
          >
            <input type="hidden" name="channel" value="email" />
            <label>
              <span className="label">E-mail do responsável</span>
              <input
                name="to"
                type="email"
                defaultValue={destinations.email}
                placeholder="time@empresa.com"
                className="input"
                required
              />
            </label>
            <button className="btn h-8 w-full" type="submit" disabled={!canEmail}>
              <Mail size={12} /> Enviar por e-mail
            </button>
            <p className="text-[10px] leading-relaxed text-dim">
              {canEmail
                ? "Envio pela API da Resend. O remetente sai de RADAR_ALERT_FROM."
                : "Configure RESEND_API_KEY (e RADAR_ALERT_FROM com um domínio verificado) para liberar o e-mail."}
            </p>
          </form>
        </div>

        {recent.length > 0 && (
          <div className="rounded-lg border border-line-soft bg-[#0b1219] p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-dim">Últimos envios</p>
            <ul className="space-y-1">
              {recent.map((item, index) => (
                <li key={`${item.created_at}-${index}`} className="flex items-center gap-2 text-[10.5px] text-muted">
                  <Send size={10} className={item.status === "sent" ? "text-lime" : "text-rose"} />
                  <span className="font-medium">{item.channel === "email" ? "e-mail" : "WhatsApp"}</span>
                  <span className="min-w-0 flex-1 truncate text-dim">{item.destination}</span>
                  {item.error && <span className="truncate text-rose">{item.error.slice(0, 60)}</span>}
                  <span className="text-[9.5px] text-dim">{dateTime(item.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </Card>

      <Card className="space-y-3">
        <SectionHeader
          title="Envios automáticos"
          hint="Cada aviso de fonte já entregue, com canal, destino e horário"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/radar/alertas"
            className={`btn h-7 px-2 text-[10.5px] ${fonte ? "" : "btn-primary"}`}
          >
            Todas{sources.length > 0 ? ` · ${sources.reduce((total, item) => total + item.deliveries, 0)}` : ""}
          </Link>
          {sources
            .filter((item) => item.source)
            .map((item) => (
              <Link
                key={item.source}
                href={`/radar/alertas?fonte=${encodeURIComponent(item.source!)}`}
                className={`btn h-7 px-2 text-[10.5px] ${fonte === item.source ? "btn-primary" : ""}`}
              >
                {sourceLabel(item.source!)} · {item.deliveries}
              </Link>
            ))}
        </div>

        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-line-soft bg-[#0b1219] px-3 py-3 text-[11px] text-dim">
            {fonte
              ? `Nenhum aviso entregue para ${sourceLabel(fonte)} até agora.`
              : "Nenhum aviso automático entregue ainda. Eles aparecem aqui depois da primeira sincronização que gerar alerta de fonte."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-3 py-2 font-medium">Aviso</th>
                  <th className="px-3 py-2 font-medium">Fonte</th>
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((item) => {
                  const kind = KIND[item.kind] ?? { label: item.kind, tone: "neutral" as const };
                  return (
                    <tr key={item.id} className="border-b border-line-soft last:border-0 align-top hover:bg-[#101923]">
                      <td className="px-3 py-2">
                        <Badge tone={kind.tone}>{kind.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted">
                        {item.source ? sourceLabel(item.source) : "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          {item.channel === "email" ? (
                            <Mail size={11} className="text-dim" />
                          ) : (
                            <MessageCircle size={11} className="text-dim" />
                          )}
                          {item.channel === "email" ? "E-mail" : "WhatsApp"}
                        </span>
                      </td>
                      <td className="max-w-[170px] truncate px-3 py-2 text-[11px] text-dim" title={item.destination}>
                        {item.destination}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {item.status === "sent" ? (
                          <span className="text-lime">entregue</span>
                        ) : (
                          <span className="text-rose" title={item.error ?? undefined}>
                            falhou
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[10.5px] tabular-nums text-dim">
                        {dateTime(item.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum alerta ainda"
            hint="Monitore uma marca e rode uma sincronização em Fontes para começar a receber."
            action={
              <Link href="/radar/marcas" className="btn mt-1 h-8 text-[11.5px]">
                Monitorar marca
              </Link>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <SectionHeader title="Linha do tempo" hint="Mais recente primeiro" />
            <BellRing size={14} className="text-dim" />
          </div>
          <div className="divide-y divide-[#172029] border-t border-line">
            {alerts.map((alert) => {
              const kind = KIND[alert.kind] ?? { label: alert.kind, tone: "neutral" as const };
              return (
                <div key={alert.id} className="flex items-start gap-3 px-5 py-2.5">
                  <span className="mt-1.5">
                    {alert.read_at ? (
                      <Circle size={7} className="text-[#2b3947]" />
                    ) : (
                      <Circle size={7} className="fill-lime text-lime" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      <span className="text-[10.5px] text-dim">{relativeTime(alert.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted">{alert.detail}</p>
                    {alert.advertiser && (
                      <p className="mt-0.5 line-clamp-1 text-[10.5px] text-dim">
                        {alert.advertiser} · {alert.headline ?? "sem título"}
                      </p>
                    )}
                  </div>
                  {alert.ad_id && (
                    <Link href={`/radar/anuncio/${alert.ad_id}`} className="btn h-7 shrink-0 px-2 text-[10.5px]">
                      Abrir
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
