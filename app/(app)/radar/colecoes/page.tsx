import Link from "next/link";
import { ArrowUpRight, FolderPlus, Trophy, UserPlus } from "lucide-react";
import { AdCard } from "@/components/radar/ad-card";
import { Badge, Card, EmptyState, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { createCollectionAction, createLeadFromBoardAction } from "@/lib/radar/actions";
import { boardRevenue, briefsForCollection, leadsFromBoard } from "@/lib/radar/funnel";
import { searchAds } from "@/lib/radar/search";
import { listCollections } from "@/lib/radar/track";
import { brl } from "@/lib/format";
import { VERTICALS } from "@/lib/verticals";

export const dynamic = "force-dynamic";

const COLORS = ["#a3f04b", "#9a86ff", "#4fd1c5", "#f5b841", "#f2607a"];

export default async function ColecoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const boards = listCollections();
  const revenue = boardRevenue();
  const revenueById = new Map(revenue.map((row) => [row.collection_id, row]));
  const ranking = revenue.filter((row) => row.leads > 0);
  const leader = ranking.find((row) => row.revenue > 0);
  const maxRevenue = Math.max(1, ...ranking.map((row) => row.revenue));

  const withAds = boards.map((board) => {
    const result = searchAds({ colecao: String(board.id) });
    return {
      board,
      ads: result.rows.slice(0, 4),
      all: result.rows,
      briefs: briefsForCollection(board.id),
      leads: leadsFromBoard(board.id),
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Swipe file"
        title="Coleções"
        description="Agrupe criativos por ângulo, oferta ou cliente. O time inteiro enxerga a mesma referência — o briefing sai do anúncio e o lead nasce da prancha, com rastro do criativo que o originou."
        actions={<Badge tone="violet">{boards.length} coleções</Badge>}
      />

      {ok && (
        <div className="rounded-xl border border-lime/30 bg-lime/[0.06] px-4 py-2.5 text-[11.5px]">Coleção criada.</div>
      )}
      {erro && (
        <div className="rounded-xl border border-rose/30 bg-rose/[0.06] px-4 py-2.5 text-[11.5px] text-rose">
          Não foi possível criar o lead: {erro}
        </div>
      )}

      <Card>
        <SectionHeader title="Nova coleção" hint="Um nome curto e um propósito claro" />
        <form action={createCollectionAction} className="flex flex-wrap items-center gap-2">
          <input name="name" required placeholder="Ex.: Ganchos de prova social" className="input max-w-[320px]" />
          <select name="color" className="select w-auto">
            {COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            <FolderPlus size={13} /> Criar
          </button>
        </form>
      </Card>

      <Card padded={false}>
        <div className="px-5 pb-3 pt-5">
          <SectionHeader
            title="Receita por prancha"
            hint="Os leads de cada coleção ligados ao estágio e ao valor fechado no funil"
          />
        </div>

        {ranking.length === 0 ? (
          <div className="border-t border-line px-5 py-6">
            <EmptyState
              title="Nenhuma prancha com lead ainda"
              hint="Crie um lead a partir de uma coleção para medir quantos entraram no funil e quanto cada prancha faturou."
            />
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#0b1219] text-[10px] uppercase tracking-wider text-dim">
                  <th className="px-5 py-2 font-medium">Prancha</th>
                  <th className="px-3 py-2 text-right font-medium">Anúncios</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Vendas</th>
                  <th className="px-3 py-2 text-right font-medium">Conversão</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket</th>
                  <th className="px-5 py-2 text-right font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => {
                  const isLeader = leader?.collection_id === row.collection_id;
                  return (
                    <tr
                      key={row.collection_id}
                      className={`border-b border-line-soft last:border-0 hover:bg-[#101923] ${
                        isLeader ? "bg-lime/[0.04]" : ""
                      }`}
                    >
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: row.color }} />
                          <Link href={`/radar?colecao=${row.collection_id}`} className="truncate hover:text-lime">
                            {row.name}
                          </Link>
                          {isLeader && (
                            <Badge tone="lime" dot>
                              <Trophy size={9} /> mais receita
                            </Badge>
                          )}
                        </span>
                        <div className="mt-1 max-w-[220px]">
                          <Progress value={(row.revenue / maxRevenue) * 100} color={row.color} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.items}</td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.leads}</td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">{row.won}</td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">
                        {row.conversion.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-muted">
                        {row.won === 0 ? "—" : brl(row.ticket, true)}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right text-[11.5px] tabular-nums ${
                          isLeader ? "font-semibold text-lime" : "font-medium"
                        }`}
                      >
                        {brl(row.revenue, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {leader && (
          <p className="border-t border-line px-5 py-2.5 text-[10.5px] leading-relaxed text-dim">
            <span className="text-lime">{leader.name}</span> é a prancha que mais faturou: {leader.won} venda(s) em{" "}
            {leader.leads} lead(s) originados — {brl(leader.revenue)} com ticket de {brl(leader.ticket, true)}.
            Receita considera apenas leads criados pela coleção e etapas de venda do funil.
          </p>
        )}
      </Card>

      {withAds.length === 0 && (
        <Card>
          <EmptyState title="Nenhuma coleção ainda" hint="Crie a primeira e adicione anúncios pela página de detalhe." />
        </Card>
      )}

      <div className="space-y-4">
        {withAds.map(({ board, ads, all, briefs, leads }) => {
          const result = revenueById.get(board.id);
          return (
          <Card key={board.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: board.color }} />
              <h2 className="text-[13px] font-semibold">{board.name}</h2>
              <Badge tone="neutral">{board.items} anúncios</Badge>
              <Badge tone={briefs.length > 0 ? "violet" : "neutral"}>{briefs.length} briefing(s)</Badge>
              <Badge tone={leads > 0 ? "lime" : "neutral"}>{leads} lead(s)</Badge>
              <Badge tone={(result?.revenue ?? 0) > 0 ? "amber" : "neutral"}>
                {brl(result?.revenue ?? 0, true)} em receita
              </Badge>
              <Link
                href={`/radar?colecao=${board.id}`}
                className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-lime hover:underline"
              >
                Ver busca filtrada <ArrowUpRight size={11} />
              </Link>
            </div>

            {ads.length === 0 ? (
              <p className="text-[11.5px] text-dim">
                Coleção vazia. Abra um anúncio e use “Salvar em coleção” para começar.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {ads.map((ad) => (
                  <AdCard key={ad.id} ad={ad} collectionId={String(board.id)} />
                ))}
              </div>
            )}

            {briefs.length > 0 && (
              <div className="rounded-lg border border-line-soft bg-[#0b1219] p-2.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-dim">
                  Briefings desta prancha
                </p>
                <ul className="space-y-1">
                  {briefs.map((brief) => (
                    <li key={brief.id} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-dim">·</span>
                      <Link href={`/radar/anuncio/${brief.ad_id}?colecao=${board.id}`} className="min-w-0 flex-1 truncate hover:text-lime">
                        {brief.title}
                      </Link>
                      <span className="shrink-0 text-[10px] text-dim">
                        {brief.simulated ? "simulação" : brief.model}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {all.length > 0 && (
              <form
                action={createLeadFromBoardAction}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-line-soft bg-[#0b1219] p-2.5"
              >
                <input type="hidden" name="collectionId" value={board.id} />
                <label className="min-w-[190px] flex-1">
                  <span className="label">Anúncio de origem</span>
                  <select name="adId" className="select" required>
                    {all.map((ad) => (
                      <option key={ad.id} value={ad.id}>
                        {ad.advertiser} — {(ad.headline ?? ad.body).slice(0, 48)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[150px]">
                  <span className="label">Nome</span>
                  <input name="name" required placeholder="Nome do lead" className="input" />
                </label>
                <label className="min-w-[150px]">
                  <span className="label">WhatsApp</span>
                  <input name="phone" required placeholder="+55 11 9…" className="input" />
                </label>
                <label className="min-w-[120px]">
                  <span className="label">Cidade</span>
                  <input name="city" placeholder="opcional" className="input" />
                </label>
                <label className="min-w-[140px]">
                  <span className="label">Nicho</span>
                  <select name="vertical" className="select" defaultValue={VERTICALS[0]?.slug}>
                    {VERTICALS.map((vertical) => (
                      <option key={vertical.slug} value={vertical.slug}>
                        {vertical.short}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" type="submit">
                  <UserPlus size={13} /> Criar lead
                </button>
                <p className="w-full text-[10px] leading-relaxed text-dim">
                  O lead entra na fila de entrada com score do nicho, recebe a abertura no WhatsApp e guarda o anúncio de
                  origem. Se o telefone já existir, o ingest reaproveita o lead em vez de duplicar.
                </p>
              </form>
            )}
          </Card>
          );
        })}
      </div>
    </div>
  );
}
