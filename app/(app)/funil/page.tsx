import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { Kanban, VerticalChips } from "@/components/funil/kanban";
import { Badge, PageHeader } from "@/components/ui";
import { brl, pct } from "@/lib/format";
import { listLeads } from "@/lib/queries";
import { VERTICALS, verticalBySlug, weightedValue } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string }>;
}) {
  const params = await searchParams;
  const slug = params.vertical && verticalBySlug(params.vertical) ? params.vertical : "imobiliaria";
  const vertical = verticalBySlug(slug)!;
  const leads = listLeads({ vertical: slug, limit: 500 });
  const openStages = vertical.stages.filter((stage) => stage.kind !== "won" && stage.kind !== "lost");
  const pipeline = leads
    .filter((lead) => openStages.some((stage) => stage.key === lead.stage))
    .reduce((acc, lead) => acc + lead.value, 0);
  const forecast = leads.reduce(
    (acc, lead) => acc + weightedValue(lead.vertical, lead.stage, lead.value),
    0,
  );
  const won = leads.filter((lead) =>
    vertical.stages.some((stage) => stage.key === lead.stage && stage.kind === "won"),
  ).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        eyebrow="Pipeline"
        title="Funil por nicho"
        description="Arraste os cartões para mover o lead de etapa. Cada nicho tem etapas e probabilidades próprias."
        actions={
          <Link href="/leads/novo" className="btn btn-primary">
            <Plus size={14} /> Novo lead
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <VerticalChips
          verticals={VERTICALS.map((item) => ({ slug: item.slug, short: item.short, color: item.color }))}
          active={slug}
          basePath="/funil"
        />
        <div className="flex items-center gap-4 text-[11.5px]">
          <span className="text-dim">
            Em aberto <span className="ml-1 font-semibold text-fg">{brl(pipeline, true)}</span>
          </span>
          <span className="text-dim">
            Previsão <span className="ml-1 font-semibold text-lime">{brl(forecast, true)}</span>
          </span>
          <Badge tone="violet">
            <Target size={10} /> {won} ganhos
          </Badge>
          <Badge tone="neutral">{pct(leads.length ? (won / leads.length) * 100 : 0)} conversão</Badge>
        </div>
      </div>

      <Kanban stages={vertical.stages} leads={leads} color={vertical.color} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {vertical.cadence.slice(0, 4).map((step) => (
          <div key={step.label} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] uppercase tracking-wider text-dim">D+{step.day}</span>
              <Badge tone="neutral">{step.label}</Badge>
            </div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted">{step.template}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
