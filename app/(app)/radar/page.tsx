import Link from "next/link";
import { Activity, Building2, Flame, Gauge, Radar as RadarIcon, SearchX } from "lucide-react";
import { AdCard } from "@/components/radar/ad-card";
import { Filters } from "@/components/radar/filters";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { compact } from "@/lib/radar/score";
import { facets, radarOverview, searchAds } from "@/lib/radar/search";
import { listSaved } from "@/lib/radar/track";
import { filterQuery, first } from "@/lib/radar/url";
import type { RadarFilters } from "@/lib/radar/types";

export const dynamic = "force-dynamic";

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: RadarFilters = {
    q: first(params.q),
    campo: first(params.campo),
    rede: first(params.rede),
    origem: first(params.origem),
    pais: first(params.pais),
    idioma: first(params.idioma),
    genero: first(params.genero),
    idade: first(params.idade),
    desde: first(params.desde),
    ate: first(params.ate),
    visto: first(params.visto),
    durMin: first(params.durMin),
    curMin: first(params.curMin),
    curMax: first(params.curMax),
    comMin: first(params.comMin),
    compMin: first(params.compMin),
    cta: first(params.cta),
    midia: first(params.midia),
    dominio: first(params.dominio),
    marca: first(params.marca),
    tech: first(params.tech),
    oferta: first(params.oferta),
    ordem: first(params.ordem),
    pagina: first(params.pagina),
    colecao: first(params.colecao),
  };

  const result = searchAds(filters);
  const overview = radarOverview();
  const facetData = facets();
  const saved = listSaved();
  const demo = overview.liveSources === 0;
  const mixed = overview.synthetic > 0 && overview.liveSources > 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader
        eyebrow="Inteligência de anúncios"
        title="Radar"
        description="Busque por texto, comentário, lander e stack; filtre por engajamento, duração e oferta. O ranking usa Winning Score, não curtida crua."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={demo ? "amber" : "lime"} dot>
              {demo ? "Base de demonstração" : `${compact(overview.ads)} anúncios`}
            </Badge>
            <Link href="/radar/fontes" className="btn h-8 text-[11.5px]">
              Fontes
            </Link>
          </div>
        }
      />

      {overview.synthetic > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber/25 bg-amber/[0.05] px-4 py-2.5 text-[11.5px] text-muted">
          <RadarIcon size={13} className="text-amber" />
          <span>
            {demo ? (
              <>
                Os anúncios abaixo são <span className="text-fg">sintéticos</span>, gerados para você operar o produto
                sem chave. Nenhuma fonte real está conectada.
              </>
            ) : (
              <>
                {overview.synthetic.toLocaleString("pt-BR")} anúncios <span className="text-fg">sintéticos</span> ainda
                estão na base junto dos {compact(overview.liveSources)} vindos de fonte real.
              </>
            )}
          </span>
          {mixed ? (
            <Link href="/radar?origem=meta" className="ml-auto text-lime hover:underline">
              Ver só fonte real →
            </Link>
          ) : (
            <Link href="/radar/fontes" className="ml-auto text-lime hover:underline">
              Conectar Meta / TikTok / importação →
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Anúncios" value={compact(overview.ads)} hint={`${compact(overview.active)} no ar agora`} tone="lime" icon={<RadarIcon size={14} />} />
        <Stat label="Anunciantes" value={compact(overview.advertisers)} hint="Páginas distintas na base" tone="violet" icon={<Building2 size={14} />} />
        <Stat label="Vencedores" value={compact(overview.winners)} hint="Score 72+ com sinal de escala" tone="hot" icon={<Flame size={14} />} />
        <Stat label="Score médio" value={String(overview.avgScore)} hint="Média ponderada da base" tone="cyan" icon={<Activity size={14} />} />
        <Stat
          label="Latência da busca"
          value={`${result.tookMs < 1 ? "<1" : Math.round(result.tookMs)} ms`}
          hint={`${result.total} resultados nesta consulta`}
          tone="warm"
          icon={<Gauge size={14} />}
        />
      </div>

      <Filters filters={filters} facets={facetData} />

      {saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.1em] text-dim">Buscas salvas</span>
          {saved.map((item) => (
            <Link key={item.id} href={`/radar?${item.query}`} className="chip hover:border-[#33424f] hover:text-fg">
              {item.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-line pb-2">
        <p className="text-[11.5px] text-muted">
          <span className="font-semibold text-fg">{result.total.toLocaleString("pt-BR")}</span> anúncios
          {result.total > 0 && (
            <>
              {" "}
              · página {result.page} de {result.pages}
            </>
          )}
          {overview.newestWinner && (
            <span className="ml-2 hidden text-[10.5px] text-dim lg:inline">
              último vencedor: {overview.newestWinner.advertiser}
            </span>
          )}
        </p>
        <span className="text-[10.5px] tabular-nums text-dim">{Math.round(result.tookMs)} ms</span>
      </div>

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum anúncio com esses filtros"
            hint="Tente ampliar a janela de datas, reduzir o mínimo de curtidas ou limpar o filtro de tecnologia."
            action={
              <Link href="/radar" className="btn mt-1 h-8 text-[11.5px]">
                Limpar filtros
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {result.rows.map((ad) => (
            <AdCard key={ad.id} ad={ad} collectionId={filters.colecao} />
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          {result.page > 1 && (
            <Link href={`/radar${filterQuery(filters, { pagina: result.page - 1 })}`} className="btn h-8 text-[11.5px]">
              Anterior
            </Link>
          )}
          <span className="px-2 text-[11px] text-dim">
            {result.page} / {result.pages}
          </span>
          {result.page < result.pages && (
            <Link href={`/radar${filterQuery(filters, { pagina: result.page + 1 })}`} className="btn h-8 text-[11.5px]">
              Próxima
            </Link>
          )}
        </div>
      )}

      {result.total === 0 && filters.q && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-dim">
          <SearchX size={12} /> A busca textual usa índice FTS5 com remoção de acento — tente uma palavra só.
        </p>
      )}
    </div>
  );
}
