import { ArrowDownRight, ArrowUpRight, Timer } from "lucide-react";
import { Badge, Bars, Card, PageHeader, Progress, SectionHeader, Stat } from "@/components/ui";
import { brl, num, pct } from "@/lib/format";
import { getOverview, getReports } from "@/lib/queries";
import { VERTICALS } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default function RelatoriosPage() {
  const overview = getOverview();
  const reports = getReports();
  const maxWeek = Math.max(...reports.weekly.map((week) => week.leads), 1);
  const totalLeads = reports.byVertical.reduce((acc, row) => acc + row.leads, 0);
  const totalRevenue = reports.byVertical.reduce((acc, row) => acc + row.revenue, 0);
  const bestSource = [...reports.bySource].sort((a, b) => b.conversion - a.conversion)[0];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Inteligência"
        title="Relatórios"
        description="Onde o dinheiro entra, qual canal converte e quem está demorando para responder."
        actions={<Badge tone="violet">últimos 30 dias</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receita total" value={brl(totalRevenue, true)} hint={`${num(totalLeads)} leads na base`} tone="lime" />
        <Stat
          label="Ticket médio geral"
          value={brl(totalLeads ? totalRevenue / Math.max(1, reports.byVertical.reduce((acc, r) => acc + r.won, 0)) : 0, true)}
          hint="Receita ÷ vendas fechadas"
          tone="cyan"
        />
        <Stat
          label="Melhor canal"
          value={bestSource?.source.split("·")[0] ?? "—"}
          hint={bestSource ? `${bestSource.conversion.toFixed(0)}% de conversão` : "sem dados"}
          tone="violet"
        />
        <Stat
          label="1ª resposta média"
          value={`${overview.kpis.avgFirstResponse} min`}
          hint="Meta: abaixo de 5 min"
          tone={overview.kpis.avgFirstResponse <= 5 ? "lime" : "amber"}
          icon={<Timer size={14} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionHeader title="Evolução semanal" hint="Leads e vendas por semana (6 semanas)" />
          <div className="flex h-[170px] items-end gap-3">
            {reports.weekly.map((week) => (
              <div key={week.week} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div className="flex w-full items-end justify-center gap-1" style={{ height: 130 }}>
                  <div
                    className="w-1/2 max-w-[22px] rounded-t bg-violet/40 transition-colors group-hover:bg-violet/70"
                    style={{ height: `${Math.max(4, (week.leads / maxWeek) * 100)}%` }}
                    title={`${week.leads} leads`}
                  />
                  <div
                    className="w-1/2 max-w-[22px] rounded-t bg-lime/80 transition-colors group-hover:bg-lime"
                    style={{ height: `${Math.max(4, (week.won / maxWeek) * 100)}%` }}
                    title={`${week.won} vendas`}
                  />
                </div>
                <span className="text-[9.5px] text-dim">S{week.week.split("-")[1]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-line-soft pt-2 text-[10.5px] text-dim">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-violet/60" /> leads
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-lime" /> vendas
            </span>
            <span className="ml-auto">{brl(reports.weekly.reduce((acc, week) => acc + week.revenue, 0), true)} no período</span>
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionHeader title="Conversão por origem" hint="Onde o investimento em mídia compensa" />
          <div className="space-y-2.5">
            {reports.bySource.slice(0, 7).map((source) => (
              <div key={source.source}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="truncate text-muted">{source.source}</span>
                  <span className="shrink-0 tabular-nums text-dim">
                    {source.leads} leads · {source.conversion.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(100, source.conversion * 2)} color={source.conversion > 25 ? "#a3f04b" : "#9a86ff"} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8" padded={false}>
          <div className="px-5 pb-3 pt-5">
            <SectionHeader title="Resultado por nicho" hint="Conversão, ticket e receita" />
          </div>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-5 py-2 font-medium">Nicho</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Qualificados</th>
                  <th className="px-3 py-2 text-right font-medium">Vendas</th>
                  <th className="px-3 py-2 text-right font-medium">Conversão</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket</th>
                  <th className="px-5 py-2 text-right font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {reports.byVertical.map((row) => {
                  const vertical = VERTICALS.find((item) => item.slug === row.vertical);
                  const average = 20;
                  const delta = row.conversion - average;
                  return (
                    <tr key={row.vertical} className="border-b border-line-soft last:border-0 hover:bg-[#101923]">
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <span className="size-1.5 rounded-full" style={{ background: vertical?.color }} />
                          {vertical?.short}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.leads}</td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.qualified}</td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.won}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11.5px] tabular-nums ${
                            delta >= 0 ? "text-lime" : "text-amber"
                          }`}
                        >
                          {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                          {row.conversion.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{brl(row.ticket, true)}</td>
                      <td className="px-5 py-2.5 text-right text-[11.5px] font-medium tabular-nums">{brl(row.revenue, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-2 text-[10px] text-dim">Referência de conversão saudável no setor: 20%.</p>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <SectionHeader title="Ranking de responsáveis" hint="Receita e conversão por vendedor" />
            <div className="space-y-2.5">
              {reports.byOwner.slice(0, 5).map((owner, index) => (
                <div key={owner.owner} className="flex items-center gap-2">
                  <span className="w-3 text-[10px] text-dim">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate">{owner.owner}</span>
                      <span className="tabular-nums text-dim">{brl(owner.revenue, true)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={owner.conversion * 2} color={index === 0 ? "#a3f04b" : "#5a6b7a"} />
                      <span className="w-8 shrink-0 text-right text-[10px] text-dim">{owner.conversion.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Tempo de 1ª resposta" hint="Quem está deixando o lead esfriar" />
            <div className="space-y-1.5">
              {reports.sla.map((row) => (
                <div key={row.owner} className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{row.owner}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">{row.conversations} conv.</span>
                    <Badge tone={row.minutes <= 5 ? "lime" : row.minutes <= 30 ? "amber" : "rose"}>
                      {row.minutes} min
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Funil de cashback" hint="Crédito gerado x resgatado" />
            <div className="space-y-2 text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-dim">Gerado</span>
                <span className="tabular-nums">{brl(reports.cashback.total, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Pendente</span>
                <span className="tabular-nums text-amber">{brl(reports.cashback.pending, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Resgatado</span>
                <span className="tabular-nums text-lime">{brl(reports.cashback.redeemed, true)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line-soft pt-1.5">
                <span className="text-dim">Taxa de resgate</span>
                <span className="tabular-nums">
                  {pct(reports.cashback.total ? (reports.cashback.redeemed / reports.cashback.total) * 100 : 0)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionHeader title="Volume por nicho" hint="Leads captados em cada operação" />
        <Bars
          data={reports.byVertical.map((row) => ({
            label: VERTICALS.find((item) => item.slug === row.vertical)?.short ?? row.vertical,
            value: row.leads,
            color: VERTICALS.find((item) => item.slug === row.vertical)?.color,
          }))}
          format={(value) => `${value} leads`}
        />
      </Card>
    </div>
  );
}
