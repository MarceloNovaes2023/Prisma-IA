import Link from "next/link";
import { ArrowUpRight, Flame, Layers, MousePointerClick, Video } from "lucide-react";
import { Badge, Bars, Card, PageHeader, Progress, SectionHeader } from "@/components/ui";
import { compact } from "@/lib/radar/score";
import { trends } from "@/lib/radar/search";

export const dynamic = "force-dynamic";

export default async function TendenciasPage() {
  const { firstWords, domains, ctas, formats, advertisers } = trends();

  const busiest = [...domains].sort((a, b) => b.ads - a.ads)[0];
  const bestFormat = [...formats].sort((a, b) => b.avgScore - a.avgScore)[0];
  const bestCta = [...ctas].sort((a, b) => b.avgScore - a.avgScore)[0];
  const totalAds = domains.reduce((acc, row) => acc + row.ads, 0) || 1;
  const concentration = busiest ? Math.round((busiest.ads / totalAds) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Leitura da base"
        title="Tendências"
        description="O que está sendo testado, o que está saturando e qual combinação de gancho, formato e botão entrega o melhor score."
        actions={<Badge tone="violet">{domains.length} domínios rastreados</Badge>}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-dim">Domínio mais disputado</p>
          <p className="text-[14px] font-semibold">{busiest?.label ?? "—"}</p>
          <p className="text-[11px] text-muted">
            {busiest?.ads ?? 0} anúncios ativos ou recentes · {concentration}% da base com lander rastreado
          </p>
          <Progress value={concentration} color={concentration > 25 ? "#f2607a" : "#a3f04b"} />
          <p className="text-[10px] leading-relaxed text-dim">
            {concentration > 25
              ? "Concentração alta: o criativo é bom, mas o mesmo público já viu. Diferencie o gancho."
              : "Concentração saudável — ainda há espaço para testar a mesma oferta com ângulo novo."}
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-dim">Formato com melhor score</p>
          <p className="text-[14px] font-semibold capitalize">{bestFormat?.label ?? "—"}</p>
          <p className="text-[11px] text-muted">
            score médio {Math.round(bestFormat?.avgScore ?? 0)} em {bestFormat?.ads ?? 0} anúncios
          </p>
          <Progress value={bestFormat?.avgScore ?? 0} color="#4fd1c5" />
          <p className="text-[10px] leading-relaxed text-dim">
            Formato não ganha sozinho: compare com o mesmo gancho em outro formato antes de trocar a produção.
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-dim">Botão que mais converte atenção</p>
          <p className="text-[14px] font-semibold">{bestCta?.label ?? "—"}</p>
          <p className="text-[11px] text-muted">
            score médio {Math.round(bestCta?.avgScore ?? 0)} · {bestCta?.ads ?? 0} anúncios
          </p>
          <Progress value={bestCta?.avgScore ?? 0} color="#9a86ff" />
          <p className="text-[10px] leading-relaxed text-dim">
            O CTA do anúncio precisa aparecer igual na página de destino — quebra de expectativa derruba conversão.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Ganchos com melhor score" hint="Primeiros 46 caracteres do título" action={<Flame size={13} className="text-amber" />} />
          <div className="space-y-1.5">
            {firstWords.map((row) => (
              <Link
                key={row.label}
                href={`/radar?q=${encodeURIComponent(row.label.split(" ").slice(0, 3).join(" "))}`}
                className="flex items-center gap-2 rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5 hover:border-[#33424f]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px]">{row.label}</span>
                  <span className="block text-[9.5px] text-dim">
                    {row.ads} anúncios · {row.active} no ar · {compact(row.likes)} curtidas
                  </span>
                </span>
                <Badge tone={(row.avgScore ?? 0) >= 70 ? "hot" : "warm"}>{Math.round(row.avgScore)}</Badge>
                <ArrowUpRight size={11} className="shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Saturação por domínio" hint="Quantos anúncios apontam para a mesma página" action={<Layers size={13} className="text-cyan" />} />
          <Bars
            data={domains.map((row) => ({ label: row.label, value: row.ads, color: row.ads > 12 ? "#f2607a" : "#4fd1c5" }))}
            format={(value) => `${value}`}
          />
          <p className="mt-2 text-[10px] leading-relaxed text-dim">
            Muitos anúncios no mesmo domínio significa oferta validada — e público cansado. O Radar mostra o score médio
            para você ver se ainda vale entrar.
          </p>
        </Card>

        <Card>
          <SectionHeader title="Botões em circulação" hint="O CTA declarado no anúncio" action={<MousePointerClick size={13} className="text-violet" />} />
          <Bars data={ctas.map((row) => ({ label: row.label, value: row.ads, color: "#9a86ff" }))} />
        </Card>

        <Card>
          <SectionHeader title="Formatos" hint="Distribuição e score médio" action={<Video size={13} className="text-lime" />} />
          <Bars data={formats.map((row) => ({ label: row.label, value: row.ads, color: "#a3f04b" }))} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {formats.slice(0, 4).map((row) => (
              <div key={row.label} className="rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5">
                <p className="text-[9.5px] uppercase tracking-[0.07em] text-dim">{row.label}</p>
                <p className="text-[12px] font-semibold">score {Math.round(row.avgScore)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Anunciantes com melhor score médio" hint="Não é quem mais gasta — é quem acerta repetidamente" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-dim">
                <th className="pb-2 font-medium">Anunciante</th>
                <th className="pb-2 text-right font-medium">Anúncios</th>
                <th className="pb-2 text-right font-medium">No ar</th>
                <th className="pb-2 text-right font-medium">Curtidas</th>
                <th className="pb-2 text-right font-medium">Score médio</th>
              </tr>
            </thead>
            <tbody>
              {advertisers.map((row) => (
                <tr key={row.label} className="border-t border-line-soft">
                  <td className="py-1.5">
                    <Link href={`/radar?marca=${encodeURIComponent(row.label)}`} className="text-[11.5px] hover:text-lime">
                      {row.label}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-muted">{row.ads}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-muted">{row.active}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-muted">{compact(row.likes)}</td>
                  <td className="py-1.5 text-right">
                    <Badge tone={(row.avgScore ?? 0) >= 70 ? "hot" : (row.avgScore ?? 0) >= 45 ? "warm" : "cold"}>
                      {Math.round(row.avgScore)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
