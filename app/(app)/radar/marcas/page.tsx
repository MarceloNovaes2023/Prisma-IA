import Link from "next/link";
import { Bell, Building2, Plus, Trash2 } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Score, SectionHeader } from "@/components/ui";
import { trackBrandAction, untrackBrandAction } from "@/lib/radar/actions";
import { listBrands } from "@/lib/radar/track";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarcasPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const brands = listBrands();

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Monitoramento"
        title="Marcas monitoradas"
        description="Cada marca aqui gera alerta quando publica anúncio novo ou quando um concorrente começa a rodar o mesmo criativo."
        actions={<Badge tone="cyan">{brands.length} marcas</Badge>}
      />

      {ok && (
        <div className="rounded-xl border border-lime/30 bg-lime/[0.06] px-4 py-2.5 text-[11.5px]">
          {ok === "marca" ? "Marca adicionada ao monitoramento." : "Marca removida do monitoramento."}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <SectionHeader title="Adicionar marca" hint="Nome da página como aparece no anúncio" />
          <form action={trackBrandAction} className="space-y-2.5">
            <div>
              <label className="label">Nome</label>
              <input name="name" required placeholder="Ex.: Atacado Bella Moda" className="input" />
            </div>
            <div>
              <label className="label">Domínio (opcional)</label>
              <input name="domain" placeholder="loja.com.br" className="input" />
            </div>
            <div>
              <label className="label">Por que monitorar</label>
              <textarea name="note" rows={2} placeholder="Referência de gancho, oferta, prova social…" className="textarea" />
            </div>
            <button className="btn btn-primary w-full" type="submit">
              <Plus size={13} /> Monitorar
            </button>
            <p className="text-[10px] leading-relaxed text-dim">
              O alerta é gerado na sincronização: anúncio novo da marca, criativo copiado por terceiro ou entrada no
              radar de vencedores.
            </p>
          </form>
        </Card>

        <div className="space-y-3 lg:col-span-8">
          {brands.length === 0 ? (
            <Card>
              <EmptyState title="Nenhuma marca monitorada" hint="Comece pelas três que você mais perde cliente hoje." />
            </Card>
          ) : (
            brands.map((brand) => (
              <Card key={brand.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#141d26] text-dim">
                    <Building2 size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/radar?marca=${encodeURIComponent(brand.name)}`} className="text-[13px] font-semibold hover:text-lime">
                        {brand.name}
                      </Link>
                      {brand.domain && <span className="text-[10.5px] text-dim">{brand.domain}</span>}
                      {brand.active > 0 && <Badge tone="lime" dot>{brand.active} no ar</Badge>}
                    </div>
                    {brand.note && <p className="mt-0.5 text-[11px] text-muted">{brand.note}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-dim">
                      <span>{brand.ads} anúncios na base</span>
                      <span className="inline-flex items-center gap-1">
                        <Bell size={10} /> último novo: {brand.last_new ? relativeTime(`${brand.last_new} 00:00:00`) : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        score médio <Score value={brand.avg_score} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/radar?marca=${encodeURIComponent(brand.name)}`} className="btn h-7 px-2 text-[10.5px]">
                      Ver anúncios
                    </Link>
                    <form action={untrackBrandAction}>
                      <input type="hidden" name="id" value={brand.id} />
                      <button className="btn h-7 px-2 text-[10.5px] text-dim hover:text-rose" type="submit" title="Remover">
                        <Trash2 size={11} />
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
