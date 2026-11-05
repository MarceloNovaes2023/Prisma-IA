import Link from "next/link";
import { ArrowUpRight, Check, Megaphone, Target, Wallet } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { toggleCampaignItemAction } from "@/lib/radar/actions";
import { listCampaigns } from "@/lib/radar/campaigns";
import { brl, dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const campaigns = listCampaigns();
  const totalBudget = campaigns.reduce((acc, campaign) => acc + campaign.budget, 0);
  const totalItems = campaigns.reduce((acc, campaign) => acc + campaign.checklist.length, 0);
  const doneItems = campaigns.reduce(
    (acc, campaign) => acc + campaign.checklist.filter((item) => item.done).length,
    0,
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Radar · execução"
        title="Campanhas"
        description="Cada briefing aprovado vira uma campanha com orçamento, público e o checklist que o time percorre até subir o criativo. Nada aqui é automático: o que está marcado foi feito por alguém."
        actions={<Badge tone="violet">{campaigns.length} campanhas</Badge>}
      />

      {ok === "campanha" && (
        <div className="rounded-xl border border-lime/30 bg-lime/[0.06] px-4 py-2.5 text-[11.5px]">
          Campanha criada a partir do briefing. Checklist pronto para o time.
        </div>
      )}
      {erro && (
        <div className="rounded-xl border border-rose/30 bg-rose/[0.06] px-4 py-2.5 text-[11.5px] text-rose">
          Não foi possível criar a campanha: briefing não encontrado.
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-lime">
              <Megaphone size={14} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-dim">Campanhas</p>
              <p className="text-[13px] font-semibold tabular-nums">{campaigns.length}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-amber">
              <Wallet size={14} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-dim">Orçamento planejado</p>
              <p className="text-[13px] font-semibold tabular-nums">{brl(totalBudget, true)}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-violet">
              <Target size={14} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.09em] text-dim">Checklist concluído</p>
              <p className="text-[13px] font-semibold tabular-nums">
                {doneItems}/{totalItems}
              </p>
            </div>
          </Card>
        </div>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma campanha ainda"
            hint="Abra um anúncio, gere e salve um briefing e use “Transformar em campanha” para definir orçamento, público e o checklist de execução."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const done = campaign.checklist.filter((item) => item.done).length;
            const progress = campaign.checklist.length === 0 ? 0 : (done / campaign.checklist.length) * 100;
            return (
              <div key={campaign.id} id={`campanha-${campaign.id}`} className="scroll-mt-4">
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Megaphone size={13} className="text-lime" />
                    <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{campaign.name}</h2>
                    <Badge tone="neutral">{campaign.advertiser}</Badge>
                    <Badge tone={progress === 100 ? "lime" : progress > 0 ? "amber" : "cold"} dot>
                      {done}/{campaign.checklist.length} feitos
                    </Badge>
                    <span className="text-[10px] text-dim">{dateTime(campaign.created_at)}</span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-line-soft bg-[#0b1219] px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-[0.09em] text-dim">Orçamento</p>
                      <p className="text-[12px] font-medium tabular-nums">{brl(campaign.budget)}</p>
                      <p className="text-[10px] text-dim">
                        {brl(campaign.budget / campaign.days, true)}/dia · {campaign.days} dia(s)
                      </p>
                    </div>
                    <div className="rounded-lg border border-line-soft bg-[#0b1219] px-2.5 py-2 md:col-span-2">
                      <p className="text-[10px] uppercase tracking-[0.09em] text-dim">Público</p>
                      <p className="text-[12px] leading-relaxed">{campaign.audience}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-dim">
                    <Link
                      href={`/radar/anuncio/${campaign.ad_id}?brief=salvo`}
                      className="inline-flex items-center gap-1 hover:text-lime"
                    >
                      {campaign.brief_title} <ArrowUpRight size={10} />
                    </Link>
                    {campaign.collection_id && (
                      <Link href={`/radar/colecoes`} className="hover:text-lime">
                        · prancha #{campaign.collection_id}
                      </Link>
                    )}
                  </div>

                  <div>
                    <SectionHeader title="Checklist de execução" hint="Clique para marcar o que já foi feito" />
                    <Progress value={progress} color={progress === 100 ? "#a3f04b" : "#9a86ff"} />
                    <ul className="mt-2 space-y-1">
                      {campaign.checklist.map((item) => (
                        <li key={item.key}>
                          <form action={toggleCampaignItemAction}>
                            <input type="hidden" name="campaignId" value={campaign.id} />
                            <input type="hidden" name="key" value={item.key} />
                            <button
                              type="submit"
                              className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-[#101923]"
                            >
                              <span
                                className={`mt-[1px] grid size-4 shrink-0 place-items-center rounded border ${
                                  item.done ? "border-lime bg-lime text-lime-ink" : "border-line text-transparent"
                                }`}
                              >
                                <Check size={10} strokeWidth={3} />
                              </span>
                              <span
                                className={`text-[11.5px] leading-relaxed ${
                                  item.done ? "text-dim line-through" : "text-muted"
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
