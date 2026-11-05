import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  Clock3,
  Copy as CopyIcon,
  ExternalLink,
  Flame,
  Heart,
  Megaphone,
  MessageCircle,
  Share2,
  ShieldAlert,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { Badge, Card, PageHeader, Progress, Score, SectionHeader, Sparkline, Stat } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { BriefPanel } from "@/components/radar/brief-panel";
import { Creative } from "@/components/radar/creative";
import {
  addToCollectionAction,
  createCampaignFromBriefAction,
  removeFromCollectionAction,
} from "@/lib/radar/actions";
import { campaignsForAd, defaultAudience } from "@/lib/radar/campaigns";
import { compact, daysRunning, scoreTone, winningScore } from "@/lib/radar/score";
import { parseComments, parseReactions, parseRedirects, parseSeriesSafe, parseTech } from "@/lib/radar/parse";
import { brandStats, getAd, getVariants } from "@/lib/radar/search";
import { insightForAd } from "@/lib/radar/insights";
import { sourceLabel } from "@/lib/radar/error-rate";
import { leadOriginsForAd, listBriefs } from "@/lib/radar/funnel";
import { collectionsForAd, listCollections } from "@/lib/radar/track";
import { dateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const networkLabel: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  audience_network: "Audience Network",
};

export default async function AdDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ colecao?: string; brief?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ad = getAd(Number(id));
  if (!ad) notFound();

  const days = daysRunning(ad);
  const series = parseSeriesSafe(ad.likes_series);
  const reactions = parseReactions(ad.reactions);
  const comments = parseComments(ad.best_comments);
  const redirects = parseRedirects(ad.redirect_chain);
  const tech = parseTech(ad.tech_stack);
  const variants = getVariants(ad);
  const brand = brandStats(ad.advertiser);
  const boards = listCollections();
  const inBoards = collectionsForAd(ad.id);
  const tone = scoreTone(ad.winning_score);
  const collectionId = Number(query.colecao) || undefined;
  const briefs = listBriefs(ad.id);
  const origins = leadOriginsForAd(ad.id);
  const analise = insightForAd(ad.id);
  const campaignByBrief = new Map(campaignsForAd(ad.id).map((item) => [item.brief_id, item.id]));
  const audience = defaultAudience(ad);

  const breakdown = winningScore({
    days,
    likes: ad.likes,
    comments: ad.comments,
    shares: ad.shares,
    momentum: ad.momentum,
    variants: ad.variant_count,
    copies: ad.copy_count,
    hasLanding: Boolean(ad.landing_domain),
    hasTitle: Boolean(ad.landing_title),
    hasTech: Boolean(ad.tech_stack),
    hasCta: Boolean(ad.cta),
    active: ad.active === 1,
  });

  const totalReactions = Object.values(reactions).reduce((acc, value) => acc + value, 0) || 1;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <Link href="/radar" className="inline-flex items-center gap-1.5 text-[11.5px] text-dim hover:text-fg">
        <ArrowLeft size={12} /> Voltar para a busca
      </Link>

      <PageHeader
        eyebrow={`${networkLabel[ad.network] ?? ad.network} · ${ad.country} · ${ad.language}`}
        title={ad.advertiser}
        description={ad.headline ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ad.active === 1 ? "lime" : "cold"} dot>
              {ad.active === 1 ? `no ar há ${days} dias` : "encerrado"}
            </Badge>
            <Badge tone={tone}>Winning Score {Math.round(ad.winning_score)}</Badge>
            {ad.page_verified === 1 && (
              <Badge tone="cyan">
                <BadgeCheck size={10} /> página verificada
              </Badge>
            )}
          </div>
        }
      />

      {query.brief === "salvo" && (
        <div className="rounded-xl border border-lime/30 bg-lime/[0.06] px-4 py-2.5 text-[11.5px]">
          Briefing salvo nesta campanha. Ele fica registrado com o anúncio e volta no histórico abaixo.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <Creative ad={ad} size="detail" />

          {analise && (
            <div id="analise-ia" className="scroll-mt-6">
              <Card className="border-violet/30 bg-violet/[0.04]">
                <SectionHeader
                  title="Análise da IA"
                  hint={`Leitura do criativo na sincronização de ${sourceLabel(analise.source)} · ${dateTime(analise.created_at)}`}
                  action={
                    <Badge tone={analise.simulated === 1 ? "amber" : "violet"}>
                      <Sparkles size={9} /> {analise.simulated === 1 ? "simulado" : analise.model}
                    </Badge>
                  }
                />
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{analise.text}</p>
                <p className="mt-2 border-t border-line-soft pt-2 text-[10.5px] text-dim">
                  Leitura gerada para os {analise.ads} anúncio(s) novo(s) desta coleta e ligada a este criativo.
                  {analise.simulated === 1 && " Resumo automático sem chave de IA configurada."}
                </p>
              </Card>
            </div>
          )}

          <Card>
            <SectionHeader title="Copy do anúncio" hint="Exatamente como está no ar" action={<CopyButton value={`${ad.headline ?? ""}\n\n${ad.body}`} label="Copiar copy" />} />
            <div className="space-y-2.5">
              {ad.headline && (
                <div>
                  <p className="label">Título</p>
                  <p className="text-[13px] font-medium leading-snug">{ad.headline}</p>
                </div>
              )}
              <div>
                <p className="label">Texto principal</p>
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{ad.body}</p>
              </div>
              {ad.description && (
                <div>
                  <p className="label">Descrição do link</p>
                  <p className="text-[12px] text-muted">{ad.description}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
                <Badge tone="lime">{ad.cta ?? "sem CTA"}</Badge>
                <Badge tone="neutral">{ad.media_type}</Badge>
                <Badge tone="violet">{ad.variant_count} variação(ões) do criativo</Badge>
                {ad.copy_count > 0 && (
                  <Badge tone="rose">
                    <CopyIcon size={9} /> {ad.copy_count} anunciante(s) copiaram
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Página de destino"
              hint={ad.landing_domain ?? "a API oficial não entrega a URL de destino"}
              action={
                ad.landing_url ? (
                  <Link href={ad.landing_url} target="_blank" className="btn h-7 px-2 text-[10.5px]">
                    Abrir <ExternalLink size={10} />
                  </Link>
                ) : undefined
              }
            />
            {ad.landing_url ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-line bg-[#0b1219] p-2.5">
                  <p className="text-[12px] font-medium">{ad.landing_title ?? "—"}</p>
                  <p className="mt-0.5 break-all text-[10.5px] text-dim">{ad.landing_url}</p>
                </div>

                {redirects.length > 1 && (
                  <div className="rounded-lg border border-amber/25 bg-amber/[0.05] p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber">
                      <ShieldAlert size={12} /> Cadeia de redirecionamento ({redirects.length} saltos)
                    </p>
                    <ol className="mt-1.5 space-y-1">
                      {redirects.map((hop, index) => (
                        <li key={hop} className="flex items-start gap-1.5 text-[10.5px] text-muted">
                          <span className="mt-[1px] text-dim">{index + 1}.</span>
                          <span className="break-all">{hop}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-dim">
                      Destino diferente do link do anúncio costuma indicar cloaking — o conteúdo pode mudar por
                      dispositivo ou localização.
                    </p>
                  </div>
                )}

                {(tech.length > 0 || ad.offer_id) && (
                  <div className="flex flex-wrap gap-1.5">
                    {tech.map((item) => (
                      <Badge key={item} tone="neutral">
                        {item}
                      </Badge>
                    ))}
                    {ad.offer_id && (
                      <Badge tone="violet">
                        <Tag size={9} /> {ad.affiliate_network} · {ad.offer_id}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11.5px] text-dim">
                Este registro não traz a landing page. A Ad Library da Meta não devolve a URL de destino; para preencher,
                importe o anúncio com o campo <code className="text-muted">landing_url</code>.
              </p>
            )}
          </Card>

          {comments.length > 0 && (
            <Card>
              <SectionHeader title="Melhores comentários" hint="A objeção real está aqui, não no relatório" />
              <div className="space-y-2">
                {comments.map((comment, index) => (
                  <div key={`${comment.author}-${index}`} className="rounded-lg border border-line-soft bg-[#0b1219] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium">{comment.author}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-dim">
                        <Heart size={9} /> {compact(comment.likes)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted">{comment.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Curtidas" value={compact(ad.likes)} hint={`${compact(Math.round(ad.likes / Math.max(1, days)))} por dia`} tone="rose" icon={<Heart size={13} />} />
            <Stat label="Comentários" value={compact(ad.comments)} hint={`${((ad.comments / Math.max(1, ad.likes)) * 100).toFixed(1)}% das curtidas`} tone="violet" icon={<MessageCircle size={13} />} />
            <Stat label="Compart." value={compact(ad.shares)} hint="Sinal de propagação" tone="cyan" icon={<Share2 size={13} />} />
            <Stat label="No ar" value={`${days} d`} hint={ad.stop_date ? `parou em ${ad.stop_date}` : `visto ${relativeTime(ad.last_seen)}`} tone="lime" icon={<Clock3 size={13} />} />
          </div>

          <Card>
            <SectionHeader title="Curva de curtidas" hint="30 pontos — a inclinação final é o que importa" />
            <Sparkline data={series.length > 1 ? series : [0, ad.likes]} color="#f2607a" height={72} />
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-dim">
              <span>{ad.start_date}</span>
              <span className="inline-flex items-center gap-1">
                aceleração <span className="font-semibold text-fg">{ad.momentum.toFixed(2)}×</span>
              </span>
              <span>{ad.stop_date ?? "hoje"}</span>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Por que este score" hint="Cinco sinais, com penalidade de saturação" />
            <div className="space-y-2.5">
              {[
                { label: "Longevidade", value: breakdown.parts.longevity, max: 32, color: "#a3f04b" },
                { label: "Ritmo de engajamento", value: breakdown.parts.velocity, max: 26, color: "#4fd1c5" },
                { label: "Aceleração (7d)", value: breakdown.parts.acceleration, max: 18, color: "#9a86ff" },
                { label: "Escala (variações)", value: breakdown.parts.scale, max: 14, color: "#f5b841" },
                { label: "Execução do criativo", value: breakdown.parts.craft, max: 10, color: "#9fc3ef" },
                { label: "Saturação (cópias)", value: breakdown.parts.saturation, max: 10, color: "#f2607a" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted">{row.label}</span>
                    <span className="tabular-nums text-dim">
                      {row.value > 0 ? "+" : ""}
                      {row.value.toFixed(1)} / {row.value < 0 ? `-${row.max}` : row.max}
                    </span>
                  </div>
                  <Progress value={(Math.abs(row.value) / row.max) * 100} color={row.color} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5">
              <span className="text-[11px] text-dim">Score final</span>
              <Score value={Math.round(breakdown.score)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Segmentação registrada" hint="O que o anunciante declarou" />
            <dl className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["País", ad.country],
                ["Idioma", ad.language],
                ["Gênero", ad.gender === "female" ? "Feminino" : ad.gender === "male" ? "Masculino" : "Todos"],
                ["Idade", `${ad.age_min ?? 18}–${ad.age_max ?? 65}`],
                ["Rede", networkLabel[ad.network] ?? ad.network],
                ["Início", ad.start_date],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5">
                  <dt className="text-[9.5px] uppercase tracking-[0.08em] text-dim">{label}</dt>
                  <dd className="mt-0.5 text-[11.5px]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 space-y-1.5">
              {(["like", "love", "haha", "wow", "sad", "angry"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-12 text-[10.5px] capitalize text-dim">{key}</span>
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-lime/70"
                      style={{ width: `${(reactions[key] / totalReactions) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 text-right text-[10px] tabular-nums text-dim">{compact(reactions[key])}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Anunciante" hint="Histórico consolidado" action={<Link href={`/radar?marca=${encodeURIComponent(ad.advertiser)}`} className="text-[10.5px] text-lime hover:underline">ver todos</Link>} />
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Anúncios", String(brand.ads)],
                ["No ar", String(brand.active)],
                ["Score médio", String(brand.avgScore)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line-soft bg-[#0b1219] py-2">
                  <p className="text-[15px] font-semibold tabular-nums">{value}</p>
                  <p className="text-[9.5px] uppercase tracking-[0.07em] text-dim">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-dim">
              Domínios: {brand.domains.join(", ") || "—"}
              {brand.firstSeen && ` · primeira aparição em ${brand.firstSeen}`}
            </p>
            <div className="mt-2 flex gap-1.5">
              <Link href={`/radar?marca=${encodeURIComponent(ad.advertiser)}&ordem=duracao`} className="btn h-7 flex-1 px-2 text-[10.5px]">
                <BarChart3 size={10} /> Mais antigos
              </Link>
              <Link href={`/radar?marca=${encodeURIComponent(ad.advertiser)}&ordem=aceleracao`} className="btn h-7 flex-1 px-2 text-[10.5px]">
                <Flame size={10} /> Acelerando
              </Link>
            </div>
          </Card>

          {variants.length > 0 && (
            <Card>
              <SectionHeader title="Mesmo criativo em outras contas" hint="Quem copiou, com qual resultado" />
              <div className="space-y-1.5">
                {variants.map((variant) => (
                  <Link
                    key={variant.id}
                    href={`/radar/anuncio/${variant.id}`}
                    className="flex items-center gap-2 rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5 hover:border-[#33424f]"
                  >
                    <ArrowRightLeft size={11} className="shrink-0 text-dim" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px]">{variant.advertiser}</span>
                      <span className="block text-[9.5px] text-dim">
                        desde {variant.start_date} · {variant.landing_domain ?? "sem lander"}
                      </span>
                    </span>
                    <Badge tone={variant.active === 1 ? "lime" : "cold"}>{variant.active === 1 ? "no ar" : "off"}</Badge>
                    <span className="text-[10.5px] tabular-nums text-muted">{Math.round(variant.winning_score)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionHeader title="Salvar em coleção" hint="O swipe file do time" />
            {inBoards.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {boards
                  .filter((board) => inBoards.includes(board.id))
                  .map((board) => (
                    <form key={board.id} action={removeFromCollectionAction}>
                      <input type="hidden" name="collectionId" value={board.id} />
                      <input type="hidden" name="adId" value={ad.id} />
                      <input type="hidden" name="back" value={`/radar/anuncio/${ad.id}`} />
                      <button className="chip hover:border-rose/50 hover:text-rose" type="submit">
                        {board.name} · remover
                      </button>
                    </form>
                  ))}
              </div>
            )}
            <form action={addToCollectionAction} className="flex gap-2">
              <input type="hidden" name="adId" value={ad.id} />
              <input type="hidden" name="back" value={`/radar/anuncio/${ad.id}`} />
              <select name="collectionId" className="select" required>
                {boards
                  .filter((board) => !inBoards.includes(board.id))
                  .map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
              </select>
              <button className="btn" type="submit" disabled={boards.length === inBoards.length}>
                Adicionar
              </button>
            </form>
            <Link href="/radar/colecoes" className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-dim hover:text-fg">
              <Users size={10} /> gerenciar coleções
            </Link>
          </Card>

          <Card>
            <SectionHeader title="Briefing para o time" hint="Ângulo, ganchos, roteiro e o que validar" />
            <BriefPanel adId={ad.id} collectionId={collectionId} />
          </Card>

          {briefs.length > 0 && (
            <Card>
              <SectionHeader
                title="Briefings salvos"
                hint={`${briefs.length} nesta campanha · vire campanha, defina orçamento e público`}
              />
              <div className="space-y-2">
                {briefs.map((item) => (
                  <details key={item.id} className="rounded-lg border border-line-soft bg-[#0b1219] p-2.5">
                    <summary className="cursor-pointer list-none">
                      <span className="text-[11.5px] font-medium">{item.title}</span>
                      <span className="ml-1.5 text-[10px] text-dim">
                        {dateTime(item.created_at)} · {item.simulated ? "simulação" : item.model}
                      </span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-muted">{item.text}</p>
                    <div className="mt-2">
                      <CopyButton value={item.text} label="Copiar briefing" />
                    </div>

                    {campaignByBrief.has(item.id) ? (
                      <Link
                        href={`/radar/campanhas#campanha-${campaignByBrief.get(item.id)}`}
                        className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-lime hover:underline"
                      >
                        <Megaphone size={11} /> Campanha criada · abrir checklist
                      </Link>
                    ) : (
                      <form
                        action={createCampaignFromBriefAction}
                        className="mt-2 flex flex-wrap items-end gap-2 border-t border-line-soft pt-2"
                      >
                        <input type="hidden" name="briefId" value={item.id} />
                        <label className="w-[104px]">
                          <span className="label">Orçamento</span>
                          <input name="budget" type="number" min="0" step="10" defaultValue={700} className="input" required />
                        </label>
                        <label className="w-[76px]">
                          <span className="label">Dias</span>
                          <input name="days" type="number" min="1" max="90" defaultValue={7} className="input" required />
                        </label>
                        <label className="min-w-[200px] flex-1">
                          <span className="label">Público</span>
                          <input name="audience" defaultValue={audience} className="input" required />
                        </label>
                        <button className="btn btn-primary h-8" type="submit">
                          <Megaphone size={12} /> Transformar em campanha
                        </button>
                      </form>
                    )}
                  </details>
                ))}
              </div>
            </Card>
          )}

          {origins.length > 0 && (
            <Card>
              <SectionHeader title="Leads gerados deste criativo" hint="Quem entrou no funil a partir desta prancha" />
              <div className="space-y-1.5">
                {origins.map((origin) => (
                  <Link
                    key={origin.lead_id}
                    href={`/inbox?lead=${origin.lead_id}`}
                    className="flex items-center justify-between rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5 text-[11px] hover:border-[#33424f]"
                  >
                    <span>Lead #{origin.lead_id}</span>
                    <span className="text-[10px] text-dim">{dateTime(origin.created_at)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <p className="px-1 text-[10px] leading-relaxed text-dim">
            Registro {ad.external_id} · origem {ad.source} · primeira captura {dateTime(ad.first_seen)} · última{" "}
            {dateTime(ad.last_seen)}
          </p>
        </div>
      </div>
    </div>
  );
}
