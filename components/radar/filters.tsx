import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { activeFilterCount, filterQuery } from "@/lib/radar/url";
import { orderOptions } from "@/lib/radar/score";
import { saveSearchAction } from "@/lib/radar/actions";
import type { Facets } from "@/lib/radar/search";
import type { RadarFilters } from "@/lib/radar/types";

/** Mantém no select um valor ativo que não esteja na lista de facetas. */const SOURCE_LABEL: Record<string, string> = {
  sandbox: "Demonstração",
  meta: "Meta Ad Library",
  tiktok: "TikTok",
  import: "Importado",
};

const withValue = (options: { value: string; label: string }[], value?: string) =>
  value && !options.some((option) => option.value === value) ? [...options, { value, label: value }] : options;

const select = (options: { value: string; label: string }[], value?: string) =>
  withValue(options, value).map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));

export function Filters({ filters, facets }: { filters: RadarFilters; facets: Facets }) {
  const count = activeFilterCount(filters);
  const query = filterQuery(filters).replace(/^\?/, "");

  return (
    <form action="/radar" method="get" className="card space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Texto do anúncio, título, comentário, lander ou anunciante…"
            className="input pl-8"
          />
        </div>
        <select name="campo" defaultValue={filters.campo ?? "todos"} className="select w-auto">
          {select([
            { value: "todos", label: "Em todos os campos" },
            { value: "corpo", label: "Texto do anúncio" },
            { value: "titulo", label: "Título" },
            { value: "comentarios", label: "Comentários" },
            { value: "lander", label: "Título da landing page" },
            { value: "anunciante", label: "Anunciante" },
          ], filters.campo)}
        </select>
        <select name="ordem" defaultValue={filters.ordem ?? "score"} className="select w-auto">
          {orderOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          Buscar
        </button>
        {count > 0 && (
          <Link href="/radar" className="btn btn-ghost">
            Limpar ({count})
          </Link>
        )}
      </div>

      <details className="group" open={count > 1}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-muted">
          <SlidersHorizontal size={12} />
          Filtros avançados
          <span className="text-dim">{count > 0 ? `· ${count} ativo${count > 1 ? "s" : ""}` : "· rede, país, engajamento, duração, CTA, stack"}</span>
        </summary>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className="label">Rede</span>
            <select name="rede" defaultValue={filters.rede ?? ""} className="select">
              {select([
                { value: "", label: "Todas" },
                { value: "facebook", label: "Facebook" },
                { value: "instagram", label: "Instagram" },
                { value: "tiktok", label: "TikTok" },
                { value: "audience_network", label: "Audience Network" },
              ], filters.rede)}
            </select>
          </label>

          <label className="block">
            <span className="label">Origem do dado</span>
            <select name="origem" defaultValue={filters.origem ?? ""} className="select">
              {select(
                [
                  { value: "", label: "Todas" },
                  ...facets.fontes.map((item) => ({
                    value: item.value,
                    label: `${SOURCE_LABEL[item.value] ?? item.value} (${item.count})`,
                  })),
                ],
                filters.origem,
              )}
            </select>
          </label>

          <label className="block">
            <span className="label">País</span>
            <select name="pais" defaultValue={filters.pais ?? ""} className="select">
              {select([{ value: "", label: "Todos" }, ...facets.paises.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }))], filters.pais)}
            </select>
          </label>

          <label className="block">
            <span className="label">Idioma</span>
            <select name="idioma" defaultValue={filters.idioma ?? ""} className="select">
              {select([
                { value: "", label: "Todos" },
                { value: "pt", label: "Português" },
                { value: "es", label: "Espanhol" },
                { value: "en", label: "Inglês" },
              ], filters.idioma)}
            </select>
          </label>

          <label className="block">
            <span className="label">Gênero</span>
            <select name="genero" defaultValue={filters.genero ?? "todos"} className="select">
              {select([
                { value: "todos", label: "Todos" },
                { value: "female", label: "Feminino" },
                { value: "male", label: "Masculino" },
              ], filters.genero)}
            </select>
          </label>

          <label className="block">
            <span className="label">Faixa de idade</span>
            <select name="idade" defaultValue={filters.idade ?? ""} className="select">
              {select([
                { value: "", label: "Todas" },
                { value: "18-24", label: "18–24" },
                { value: "25-34", label: "25–34" },
                { value: "35-44", label: "35–44" },
                { value: "45-54", label: "45–54" },
                { value: "55-64", label: "55–64" },
                { value: "65+", label: "65+" },
              ], filters.idade)}
            </select>
          </label>

          <label className="block">
            <span className="label">Visto nos últimos</span>
            <select name="visto" defaultValue={filters.visto ?? ""} className="select">
              {select([
                { value: "", label: "Qualquer data" },
                { value: "1", label: "24 horas" },
                { value: "3", label: "3 dias" },
                { value: "7", label: "7 dias" },
                { value: "30", label: "30 dias" },
                { value: "90", label: "90 dias" },
              ], filters.visto)}
            </select>
          </label>

          <label className="block">
            <span className="label">No ar há (mín. dias)</span>
            <input name="durMin" type="number" min="1" defaultValue={filters.durMin ?? ""} placeholder="60" className="input" />
          </label>

          <label className="block">
            <span className="label">Curtidas (mín.)</span>
            <input name="curMin" type="number" min="0" defaultValue={filters.curMin ?? ""} placeholder="5000" className="input" />
          </label>

          <label className="block">
            <span className="label">Curtidas (máx.)</span>
            <input name="curMax" type="number" min="0" defaultValue={filters.curMax ?? ""} placeholder="—" className="input" />
          </label>

          <label className="block">
            <span className="label">Comentários (mín.)</span>
            <input name="comMin" type="number" min="0" defaultValue={filters.comMin ?? ""} placeholder="—" className="input" />
          </label>

          <label className="block">
            <span className="label">Compart. (mín.)</span>
            <input name="compMin" type="number" min="0" defaultValue={filters.compMin ?? ""} placeholder="—" className="input" />
          </label>

          <label className="block">
            <span className="label">Formato</span>
            <select name="midia" defaultValue={filters.midia ?? ""} className="select">
              {select([
                { value: "", label: "Todos" },
                { value: "image", label: "Imagem" },
                { value: "video", label: "Vídeo" },
                { value: "carousel", label: "Carrossel" },
                { value: "link", label: "Link" },
              ], filters.midia)}
            </select>
          </label>

          <label className="block">
            <span className="label">Botão (CTA)</span>
            <select name="cta" defaultValue={filters.cta ?? ""} className="select">
              {select([{ value: "", label: "Todos" }, ...facets.ctas.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }))], filters.cta)}
            </select>
          </label>

          <label className="block">
            <span className="label">Domínio da landing</span>
            <input name="dominio" defaultValue={filters.dominio ?? ""} placeholder="loja.com.br" className="input" />
          </label>

          <label className="block">
            <span className="label">Anunciante</span>
            <input name="marca" defaultValue={filters.marca ?? ""} placeholder="nome da página" className="input" />
          </label>

          <label className="block">
            <span className="label">Tecnologia da landing</span>
            <select name="tech" defaultValue={filters.tech ?? ""} className="select">
              {select([{ value: "", label: "Todas" }, ...facets.techs.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }))], filters.tech)}
            </select>
          </label>

          <label className="block">
            <span className="label">Oferta de afiliado</span>
            <select name="oferta" defaultValue={filters.oferta ?? ""} className="select">
              {select(
                [
                  { value: "", label: "Todos" },
                  { value: "sim", label: "Só com oferta rastreada" },
                  ...facets.redesAfiliado.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` })),
                ],
                filters.oferta,
              )}
            </select>
          </label>

          <div className="col-span-2 flex items-end xl:col-span-2">
            <button type="submit" className="btn w-full">
              Aplicar filtros
            </button>
          </div>
        </div>
      </details>

      {query && (
        <details className="border-t border-line-soft pt-2">
          <summary className="cursor-pointer list-none text-[10.5px] text-dim">Salvar esta busca</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input name="name" placeholder="Nome da busca" className="input h-8 max-w-[220px]" />
            <input type="hidden" name="query" value={query} />
            <button formAction={saveSearchAction} className="btn h-8 text-[11.5px]">
              Salvar
            </button>
          </div>
        </details>
      )}
    </form>
  );
}
