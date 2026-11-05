import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, Layers, Repeat2, Target } from "lucide-react";
import { VERTICAL_ICONS } from "@/components/sidebar";
import { Badge, Card, PageHeader } from "@/components/ui";
import { brl } from "@/lib/format";
import { VERTICALS } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default function NichosPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Playbooks"
        title="9 operações prontas"
        description="Cada nicho tem funil, roteiro de qualificação, cadência, regra de cashback e tratamento de objeção próprios. Tudo editável no código, nenhum genérico."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {VERTICALS.map((vertical) => {
          const Icon = VERTICAL_ICONS[vertical.icon];
          const stageList = vertical.stages.filter((stage) => !stage.kind);
          return (
            <Card key={vertical.slug} className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${vertical.color}1f`, color: vertical.color }}
                >
                  {Icon ? <Icon size={15} /> : <Layers size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[13px] font-semibold">{vertical.name}</h2>
                  <p className="text-[10.5px] text-dim">
                    {vertical.segment} · ticket {vertical.playbook.ticket} · ciclo {vertical.playbook.cycle}
                  </p>
                </div>
                <Badge tone="neutral">{stageList.length} etapas</Badge>
              </div>

              <div className="rounded-lg border border-line bg-[#0a1016] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-dim">Oferta</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg">{vertical.playbook.offer}</p>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim">{vertical.playbook.problem}</p>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {vertical.playbook.kpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-md bg-white/[0.03] px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-dim">{kpi.label}</p>
                    <p className="text-[11.5px] font-medium">{kpi.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[10.5px]">
                <CircleDollarSign size={11} style={{ color: vertical.color }} />
                {vertical.cashback.kind === "none" ? (
                  <span className="text-dim">{vertical.cashback.label}</span>
                ) : (
                  <span className="text-muted">
                    {vertical.cashback.label}
                    <span className="text-dim"> · mín. {brl(vertical.cashback.minOrder)}</span>
                  </span>
                )}
              </div>

              <details className="group">
                <summary className="cursor-pointer list-none text-[10.5px] font-medium text-muted hover:text-fg">
                  Objeções e respostas ({vertical.playbook.objections.length})
                </summary>
                <ul className="mt-1.5 space-y-1.5">
                  {vertical.playbook.objections.map((objection) => (
                    <li key={objection.q} className="rounded-md bg-white/[0.02] px-2 py-1.5">
                      <p className="text-[10.5px] font-medium text-fg">“{objection.q}”</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-dim">{objection.a}</p>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-2.5">
                <span className="flex items-center gap-1 text-[10px] text-dim">
                  <Repeat2 size={10} /> {vertical.cadence.length} toques
                </span>
                <span className="flex items-center gap-1 text-[10px] text-dim">
                  <Target size={10} /> {vertical.qualification.length} critérios
                </span>
                <Link
                  href={`/captar/${vertical.slug}`}
                  className="inline-flex items-center gap-1 text-[10.5px] font-medium text-lime hover:underline"
                >
                  Captação <ArrowUpRight size={11} />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="text-[12.5px] font-semibold">Como o playbook vira automação</h2>
        <div className="mt-2 grid gap-3 text-[11px] leading-relaxed text-dim sm:grid-cols-4">
          <p>
            <span className="block text-[11px] font-medium text-fg">1. Captação</span>
            Cada nicho tem uma URL de formulário própria. O lead entra com origem marcada e opt-in registrado.
          </p>
          <p>
            <span className="block text-[11px] font-medium text-fg">2. Qualificação</span>
            As respostas viram score ponderado (0–100). Score 75+ entra na fila de prioridade do vendedor.
          </p>
          <p>
            <span className="block text-[11px] font-medium text-fg">3. Cadência</span>
            Follow-ups em D+0, D+1, D+2, D+5, D+10 — cada toque com um objetivo declarado, não mensagem solta.
          </p>
          <p>
            <span className="block text-[11px] font-medium text-fg">4. Pós-venda</span>
            Entrega libera cashback e abre a régua de recompra, que é onde a margem aparece.
          </p>
        </div>
      </Card>
    </div>
  );
}
