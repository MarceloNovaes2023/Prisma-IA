import Link from "next/link";
import { Filter, Plus, Search } from "lucide-react";
import { Avatar, Badge, Card, PageHeader, Score } from "@/components/ui";
import { brl, formatPhone, relativeTime } from "@/lib/format";
import { listLeads } from "@/lib/queries";
import { VERTICALS, scoreBand, stageOf, verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

const OWNERS = ["Ana Paula", "Rafael Lima", "Juliana Souza", "Marcos Vieira", "Camila Rocha", "Diego Martins"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vertical?: string; stage?: string; owner?: string; score?: string }>;
}) {
  const params = await searchParams;
  const leads = listLeads({
    q: params.q,
    vertical: params.vertical,
    stage: params.stage,
    owner: params.owner,
    minScore: params.score ? Number(params.score) : undefined,
  });

  const totalValue = leads.reduce((acc, lead) => acc + lead.value, 0);
  const hot = leads.filter((lead) => lead.score >= 75).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        eyebrow="Base"
        title="Leads"
        description="Toda a base com score, etapa, origem e responsável. Filtre por nicho para trabalhar uma operação específica."
        actions={
          <Link href="/leads/novo" className="btn btn-primary">
            <Plus size={14} /> Novo lead
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <form action="/leads" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Nome, telefone ou tag"
              className="input h-8 w-[210px] pl-8 text-[12px]"
            />
          </div>
          <select name="vertical" defaultValue={params.vertical ?? ""} className="select h-8 w-auto py-0 text-[11.5px]">
            <option value="">Todos os nichos</option>
            {VERTICALS.map((vertical) => (
              <option key={vertical.slug} value={vertical.slug}>
                {vertical.short}
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={params.owner ?? ""} className="select h-8 w-auto py-0 text-[11.5px]">
            <option value="">Todos os responsáveis</option>
            {OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <select name="score" defaultValue={params.score ?? ""} className="select h-8 w-auto py-0 text-[11.5px]">
            <option value="">Qualquer score</option>
            <option value="75">Quentes (75+)</option>
            <option value="45">Mornos (45+)</option>
          </select>
          <button type="submit" className="btn h-8">
            <Filter size={12} /> Filtrar
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11.5px] text-dim">
          <span>
            {leads.length} leads · <span className="text-fg">{brl(totalValue, true)}</span>
          </span>
          <Badge tone="lime">{hot} quentes</Badge>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-line bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                <th className="px-4 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Nicho</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Responsável</th>
                <th className="px-4 py-2 text-right font-medium">Último contato</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const vertical = verticalBySlug(lead.vertical);
                const stage = stageOf(lead.vertical, lead.stage);
                const band = scoreBand(lead.score);
                return (
                  <tr key={lead.id} className="border-b border-line-soft last:border-0 hover:bg-[#101923]">
                    <td className="px-4 py-2">
                      <Link href={`/inbox?lead=${lead.id}`} className="flex items-center gap-2 group">
                        <Avatar name={lead.name} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium group-hover:text-lime">
                            {lead.name}
                          </span>
                          <span className="block text-[10px] text-dim">{formatPhone(lead.phone)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                        <span className="size-1.5 rounded-full" style={{ background: vertical?.color }} />
                        {vertical?.short}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11.5px] text-muted">{stage?.label ?? lead.stage}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5 items-center">
                        <Score value={lead.score} />
                        <Badge tone={band.tone}>{band.label}</Badge>
                        {band.action && (
                          <div className="text-[10px] text-dim whitespace-break-all" title={band.action}>
                            {band.action.substring(0, 60)}{band.action.length > 60 ? "..." : ""}
                          </div>
                        )}
                        {band.followupDays !== undefined && (
                          <div className="text-[10px] text-dim">Próximo follow-up em {band.followupDays} dias</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-muted">
                      {brl(lead.value, true)}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-muted">
                      <span className="line-clamp-1 max-w-[140px]">{lead.source}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                        <Avatar name={lead.owner} size={18} />
                        {lead.owner.split(" ")[0]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] text-dim">
                      {relativeTime(lead.last_inbound_at ?? lead.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <p className="px-4 py-10 text-center text-[12.5px] text-dim">
            Nenhum lead com esses filtros.{" "}
            <Link href="/leads" className="text-lime hover:underline">Limpar filtros</Link>
          </p>
        )}
      </Card>
    </div>
  );
}