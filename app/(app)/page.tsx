import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Flame,
  Plus,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { RunCadenceButton } from "@/components/run-cadence-button";
import { Avatar, Badge, Card, PageHeader, SectionHeader, Sparkline, Stat } from "@/components/ui";
import { brl, dayLabel, num, pct, relativeTime } from "@/lib/format";
import { getOverview, getReports, getSettings } from "@/lib/queries";
import { VERTICALS } from "@/lib/verticals";

export const dynamic = "force-dynamic";

function buildPortfolioFunnel(
  distribution: { vertical: string; stage: string; count: number }[],
) {
  const counts = new Map<string, Map<string, number>>();
  for (const row of distribution) {
    if (!counts.has(row.vertical)) counts.set(row.vertical, new Map());
    counts.get(row.vertical)!.set(row.stage, row.count);
  }

  const buckets = { novo: 0, qualificado: 0, negociacao: 0, fechamento: 0, ganho: 0 };

  for (const vertical of VERTICALS) {
    const open = vertical.stages.filter((stage) => !stage.kind);
    const won = vertical.stages.filter((stage) => stage.kind === "won");
    const map = counts.get(vertical.slug) ?? new Map<string, number>();
    open.forEach((stage, index) => {
      const count = map.get(stage.key) ?? 0;
      if (index === 0) buckets.novo += count;
      else if (index === 1) buckets.qualificado += count;
      else if (index === open.length - 1) buckets.fechamento += count;
      else buckets.negociacao += count;
    });
    for (const stage of won) buckets.ganho += map.get(stage.key) ?? 0;
  }

  const total = Math.max(1, buckets.novo + buckets.qualificado + buckets.negociacao + buckets.fechamento);
  const steps = [
    { label: "Novos leads", count: buckets.novo, color: "#a3f04b" },
    { label: "Qualificados", count: buckets.qualificado, color: "#c3f56b" },
    { label: "Em negociação", count: buckets.negociacao, color: "#d9c26a" },
    { label: "Fechamento", count: buckets.fechamento, color: "#f5b841" },
  ].map((step) => ({ ...step, conversion: (step.count / total) * 100 }));

  return { steps, won: buckets.ganho, total };
}

export default async function PainelPage() {
  const overview = await getOverview();
  const reports = await getReports();
  const settings = await getSettings();
  const funnel = buildPortfolioFunnel(overview.stageDistribution);
  const daily = overview.daily;
  const maxDaily = Math.max(...daily.map((d) => d.leads), 1);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow={settings.workspace ?? "PRISMA IA"}
        title="Painel de vendas"
        description="Todos os nichos em um só lugar: entrada de leads, qualificação por score, cadências rodando e receita fechada."
        actions={
          <>
            <RunCadenceButton />
            <Link href="/leads/novo" className="btn">
              <Plus size={14} /> Novo lead
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Receita fechada"
          value={brl(overview.kpis.wonRevenue, true)}
          hint={`${num(overview.kpis.leads)} leads na base`}
          tone="lime"
          icon={<Wallet size={14} />}
        />
        <Stat
          label="Pipeline aberto"
          value={brl(overview.kpis.pipeline, true)}
          hint={`${num(overview.byVertical.length)} nichos ativos`}
          tone="violet"
          icon={<TrendingUp size={14} />}
        />
        <Stat
          label="Previsão ponderada"
          value={brl(overview.kpis.forecast, true)}
          hint="Valor × probabilidade da etapa"
          tone="cyan"
          icon={<Target size={14} />}
        />
        <Stat
          label="1ª resposta"
          value={`${overview.kpis.avgFirstResponse || 0} min`}
          hint={`${overview.kpis.followupsDue} follow-ups vencidos`}
          tone={overview.kpis.avgFirstResponse <= 5 ? "lime" : "amber"}
          icon={<Clock3 size={14} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader
            title="Funil consolidado"
            hint="Etapas normalizadas entre os 9 nichos"
            action={
              <Badge tone="lime" dot>
                {funnel.won} vendas fechadas
              </Badge>
            }
          />
          <div className="space-y-2.5">
            {funnel.steps.map((step) => (
              <div key={step.label}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{step.label}</span>
                  <span className="tabular-nums text-dim">
                    <span className="text-fg">{step.count}</span> · {step.conversion.toFixed(0)}%
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-lg bg-white/[0.03]">
                  <div
                    className="h-full rounded-lg transition-all"
                    style={{
                      width: `${Math.max(5, (step.count / Math.max(...funnel.steps.map((s) => s.count), 1)) * 100)}%`,
                      background: `linear-gradient(90deg, ${step.color}dd, ${step.color}88)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line-soft pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dim">Score médio</p>
              <p className="text-[15px] font-semibold">{overview.kpis.avgScore}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dim">Leads quentes</p>
              <p className="text-[15px] font-semibold text-lime">{overview.kpis.hotLeads}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dim">% qualificados</p>
              <p className="text-[15px] font-semibold">{pct(overview.kpis.qualifiedRate)}</p>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionHeader
            title="Precisa de atenção"
            hint="Cliente respondeu e ninguém retornou"
            action={<Badge tone={overview.alerts.length ? "rose" : "neutral"}>{overview.alerts.length}</Badge>}
          />
          <div className="space-y-2">
            {overview.alerts.map((alert) => {
              const vertical = VERTICALS.find((v) => v.slug === alert.vertical);
              return (
                <Link
                  key={alert.leadId}
                  href={`/inbox?lead=${alert.leadId}`}
                  className="row-hover flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-line"
                >
                  <Avatar name={alert.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{alert.name}</p>
                    <p className="truncate text-[11px] text-dim">
                      {vertical?.short} · {alert.detail}
                    </p>
                  </div>
                  <Badge tone={alert.minutes > 240 ? "rose" : "amber"}>
                    {alert.minutes >= 2880
                      ? `${Math.round(alert.minutes / 1440)}d`
                      : `${Math.max(1, Math.round(alert.minutes / 60))}h`}
                  </Badge>
                  <ArrowRight size={13} className="text-dim" />
                </Link>
              );
            })}
            {overview.alerts.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12px] text-dim">
                Nenhuma conversa esperando resposta. Bom trabalho.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-[#0b1219] p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-lime/15 text-lime">
                <Flame size={13} />
              </span>
              <p className="text-[12px] font-medium">{overview.kpis.hotLeads} leads quentes na fila</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              Score 75+ priorizados nas cadências. Rode o motor para disparar os follow-ups vencidos.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader
            title="Entrada de leads · 14 dias"
            hint={`${num(daily.reduce((acc, d) => acc + d.leads, 0))} leads no período`}
            action={<Badge tone="violet">auto</Badge>}
          />
          <div className="flex h-[92px] items-end gap-1.5">
            {daily.map((day) => (
              <div key={day.day} className="group relative flex flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t-[3px] bg-gradient-to-t from-violet/30 to-violet/80 transition-all group-hover:from-lime/40 group-hover:to-lime"
                  style={{ height: `${Math.max(6, (day.leads / maxDaily) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#1a2531] px-1.5 py-0.5 text-[10px] group-hover:block">
                  {day.leads} leads
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-dim">
            <span>{daily[0] ? dayLabel(daily[0].day) : ""}</span>
            <span>{daily[daily.length - 1] ? dayLabel(daily[daily.length - 1].day) : ""}</span>
          </div>
          <div className="mt-3 border-t border-line-soft pt-3">
            <Sparkline data={daily.map((d) => d.messages)} color="#9a86ff" height={34} />
            <p className="mt-1 text-[10.5px] text-dim">Volume de mensagens trocadas no período</p>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionHeader title="Origem dos leads" hint="Conversão até a venda por canal" />
          <div className="space-y-2.5">
            {overview.sources.slice(0, 6).map((source) => {
              const conversion = source.leads ? (source.won / source.leads) * 100 : 0;
              return (
                <div key={source.source} className="flex items-center gap-3">
                  <span className="w-[148px] shrink-0 truncate text-[11.5px] text-muted">{source.source}</span>
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-lime/70"
                      style={{ width: `${Math.min(100, conversion * 2.2)}%` }}
                    />
                  </span>
                  <span className="w-[74px] shrink-0 text-right text-[11px] tabular-nums text-dim">
                    {source.leads} · {conversion.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8" padded={false}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <SectionHeader title="Desempenho por nicho" hint="Receita fechada, conversão e ticket médio" />
            <Link href="/relatorios" className="text-[11.5px] font-medium text-lime hover:underline">
              Relatório completo
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-y border-line bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-5 py-2 font-medium">Nicho</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Conversão</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket</th>
                  <th className="px-5 py-2 text-right font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {reports.byVertical.map((row) => {
                  const vertical = VERTICALS.find((v) => v.slug === row.vertical);
                  return (
                    <tr key={row.vertical} className="border-b border-line-soft last:border-0 hover:bg-[#101923]">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full" style={{ background: vertical?.color }} />
                          <span className="text-[12.5px] font-medium">{vertical?.short ?? row.vertical}</span>
                          <span className="text-[10.5px] text-dim">{vertical?.segment}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-muted">{row.leads}</td>
                      <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">
                        <span className={row.conversion >= 25 ? "text-lime" : "text-muted"}>
                          {row.conversion.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-muted">
                        {brl(row.ticket, true)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-[12px] font-medium tabular-nums">
                        {brl(row.revenue, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Cashback gerado" hint="Crédito girando na base" />
            <p className="text-[24px] font-semibold leading-none">{brl(reports.cashback.total, true)}</p>
            <div className="mt-3 space-y-1.5 text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-dim">Pendente (aguardando entrega)</span>
                <span className="tabular-nums">{brl(reports.cashback.pending, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Liberado</span>
                <span className="tabular-nums text-lime">{brl(reports.cashback.credited, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Resgatado</span>
                <span className="tabular-nums text-muted">{brl(reports.cashback.redeemed, true)}</span>
              </div>
            </div>
            <Link href="/operacoes" className="btn mt-3 w-full">
              Ver pedidos e cashback
            </Link>
          </Card>

          <Card>
            <SectionHeader title="Atividade recente" />
            <div className="space-y-2">
              {overview.activity.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-2">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-white/5 text-dim">
                    <Zap size={10} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] text-muted">{event.detail}</p>
                    <p className="text-[10px] text-dim">
                      {event.lead_name ? `${event.lead_name} · ` : ""}
                      {relativeTime(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
