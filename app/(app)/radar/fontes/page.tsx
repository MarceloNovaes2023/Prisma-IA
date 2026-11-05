import Link from "next/link";
import { AlertTriangle, CheckCircle2, CloudDownload, Database, KeyRound, PlayCircle, Timer, Upload } from "lucide-react";
import { Badge, Card, PageHeader, Progress, SectionHeader, Sparkline } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { syncAction } from "@/lib/radar/actions";
import { runSchedulerAction } from "@/lib/radar/scheduler-actions";
import { schedulerSnapshot } from "@/lib/radar/scheduler-state";
import { dailyCollectHealth, sourceHealth } from "@/lib/radar/health";
import { isOwnLease, syncLease } from "@/lib/radar/lock";
import { sourceStatuses, syncHistory } from "@/lib/radar/track";
import { insightsEnabled, latestInsights } from "@/lib/radar/insights";
import { sourceLabel } from "@/lib/radar/error-rate";
import { dateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ENV_HINT: Record<string, string> = {
  meta: "META_AD_LIBRARY_TOKEN (+ META_AD_LIBRARY_COUNTRIES opcional)",
  tiktok: "TIKTOK_CLIENT_KEY · TIKTOK_CLIENT_SECRET",
  bing: "nenhuma variável (RADAR_BING_ENABLED=off desliga)",
  import: "nenhuma variável",
  sandbox: "nenhuma variável",
};

export default async function FontesPage({
  searchParams,
}: {
  searchParams: Promise<{ feito?: string; fonte?: string; inseridos?: string; atualizados?: string; ms?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const sources = sourceStatuses();
  const history = syncHistory(10);
  const scheduler = schedulerSnapshot();
  const daily = dailyCollectHealth(14);
  const health = sourceHealth(30);
  const insights = latestInsights(6);
  const insightsOn = insightsEnabled();
  const totalInserted = daily.reduce((acc, day) => acc + day.inserted, 0);
  const totalRuns = daily.reduce((acc, day) => acc + day.runs, 0);
  const totalErrors = daily.reduce((acc, day) => acc + day.errors, 0);
  const errorRate = totalRuns === 0 ? 0 : (totalErrors / totalRuns) * 100;
  const weightedRuns = health.reduce((acc, item) => acc + item.runs, 0);
  const overallMs =
    weightedRuns === 0
      ? 0
      : Math.round(health.reduce((acc, item) => acc + item.avgMs * item.runs, 0) / weightedRuns);
  const maxInserted = Math.max(1, ...daily.map((day) => day.inserted));
  const latencySeries = daily.filter((day) => day.runs > 0).map((day) => day.avgMs);
  const lease = syncLease();
  const leaseActive = lease.owner !== null && (lease.expiresAtMs ?? 0) > Date.now();
  const leaseElsewhere = leaseActive && !isOwnLease(lease.owner);
  const leaseHolder = lease.owner ? lease.owner.split(":").slice(0, 2).join(" · ") : "";
  const leaseMinutesLeft = Math.max(1, Math.ceil(((lease.expiresAtMs ?? 0) - Date.now()) / 60_000));

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Dados"
        title="Fontes & sincronização"
        description="Cada linha da base sabe de onde veio. Fonte real, importação ou demonstração — nunca misturado sem aviso."
        actions={<Link href="/radar" className="btn h-8 text-[11.5px]">Voltar ao Radar</Link>}
      />

      {params.feito && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-[11.5px] ${
            params.feito === "ok"
              ? "border-lime/30 bg-lime/[0.06]"
              : params.feito === "skipped"
                ? "border-amber/30 bg-amber/[0.06]"
                : "border-rose/30 bg-rose/[0.06]"
          }`}
        >
          {params.feito === "ok" ? <CheckCircle2 size={14} className="text-lime" /> : <AlertTriangle size={14} className="text-amber" />}
          <span>
            {params.feito === "ocupado" ? (
              <span className="font-semibold">Sincronização ocupada</span>
            ) : (
              <span className="font-semibold">{params.fonte}</span>
            )}
            {params.feito === "ok" && (
              <>
                {" "}
                · {params.inseridos} novos, {params.atualizados} atualizados em {params.ms} ms
              </>
            )}
          </span>
          {params.msg && <span className="text-dim">{params.msg}</span>}
        </div>
      )}

      <Card className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#141d26] text-dim">
            <Timer size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-[12.5px] font-semibold">Atualização automática</h2>
              <Badge tone={scheduler.started ? "lime" : "amber"} dot>
                {scheduler.started ? (scheduler.running ? "executando" : "ativo") : "parado"}
              </Badge>
            </div>
            <p className="text-[10.5px] text-dim">
              {scheduler.enabled
                ? `Roda a cada ${scheduler.minutes} min · ${
                    scheduler.sources.length ? `fontes: ${scheduler.sources.join(", ")}` : "sem fonte real configurada: em espera"
                  }`
                : "Desligado por RADAR_SYNC_ENABLED=false · use o botão abaixo para rodar sob demanda"}
            </p>
          </div>
          <form action={runSchedulerAction} className="ml-auto">
            <button className="btn h-7 px-2 text-[10.5px]" type="submit" disabled={scheduler.running}>
              <PlayCircle size={11} /> Rodar agora
            </button>
          </form>
        </div>

        <div className="grid gap-2 text-[10.5px] sm:grid-cols-3">
          {[
            ["Agendador iniciado", scheduler.startedAt ? relativeTime(scheduler.startedAt) : "—"],
            ["Última passagem", scheduler.lastRun ? relativeTime(scheduler.lastRun) : "—"],
            ["Próxima passagem", scheduler.nextRunAt ? dateTime(scheduler.nextRunAt) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line-soft bg-[#0b1219] px-2 py-1.5">
              <p className="text-[9.5px] uppercase tracking-[0.07em] text-dim">{label}</p>
              <p className="mt-0.5 text-[11px]">{value}</p>
            </div>
          ))}
        </div>

        {leaseElsewhere && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber/30 bg-amber/[0.06] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-amber">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              Outra instância está sincronizando agora ({leaseHolder}) e segura a trava por até {leaseMinutesLeft} min.
              O botão de sincronizar e o endpoint vão recusar com aviso até lá.
            </span>
          </p>
        )}

        {scheduler.lastSummary && <p className="text-[9.5px] leading-relaxed text-dim">{scheduler.lastSummary}</p>}
        <p className="text-[10px] leading-relaxed text-dim">
          Cada passagem fica registrada no histórico abaixo. Falha de fonte gera <span className="text-muted">um</span>{" "}
          alerta por sequência — e um aviso quando ela volta. Rodar de novo à mão não duplica alerta.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {sources.map((source) => (
          <Card key={source.source} className="space-y-2.5">
            <div className="flex items-start gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#141d26] text-dim">
                {source.mode === "live" ? <CloudDownload size={14} /> : source.mode === "import" ? <Upload size={14} /> : <Database size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-[12.5px] font-semibold">{source.label}</h2>
                  <Badge tone={source.mode === "live" ? "lime" : source.mode === "import" ? "cyan" : "amber"} dot>
                    {source.mode === "live" ? "conectado" : source.mode === "import" ? "manual" : "sem chave"}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-dim">{source.coverage}</p>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">{source.detail}</p>

            <p className="text-[10px] text-dim">
              <span className="text-muted">env:</span> {ENV_HINT[source.source]}
            </p>

            <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2">
              <span className="text-[10px] text-dim">
                {source.last
                  ? `última: ${relativeTime(source.last.finished_at)} · ${source.last.status} · ${source.last.duration_ms ?? 0} ms`
                  : "nunca sincronizado"}
              </span>

              <form action={syncAction} className="ml-auto flex items-center gap-1.5">
                <input type="hidden" name="source" value={source.source} />
                {(source.source === "meta" || source.source === "tiktok") && (
                  <input
                    name="searchTerms"
                    placeholder={source.source === "meta" ? "termo (opcional)" : "termo TikTok"}
                    className="input h-7 w-[130px] text-[10.5px]"
                  />
                )}
                <button className="btn h-7 px-2 text-[10.5px]" type="submit">
                  Sincronizar
                </button>
              </form>
            </div>

            {source.last?.message && <p className="text-[9.5px] leading-relaxed text-dim">{source.last.message}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeader
          title="Saúde da coleta"
          hint="Anúncios novos por dia, falhas por fonte e tempo de resposta"
        />

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Anúncios novos · 14 dias", String(totalInserted)],
            ["Execuções · falhas", `${totalRuns} · ${totalErrors}`],
            ["Tempo médio de resposta", overallMs ? `${overallMs} ms` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line-soft bg-[#0b1219] px-2.5 py-2">
              <p className="text-[9.5px] uppercase tracking-[0.07em] text-dim">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-dim">
            Anúncios novos por dia
          </p>
          <div className="flex h-24 items-end gap-1">
            {daily.map((day, index) => (
              <div
                key={day.day}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${day.day}: ${day.inserted} novo(s), ${day.updated} atualizado(s) · ${day.runs} execução(ões) · ${day.errors} falha(s) · ${day.avgMs} ms`}
              >
                <div
                  className="w-full rounded-t-[3px]"
                  style={{
                    height: `${day.inserted === 0 ? 2 : Math.max(4, (day.inserted / maxInserted) * 100)}%`,
                    background: day.errors > 0 ? "#f5b841" : "#a3f04b",
                    opacity: day.inserted === 0 ? 0.3 : 0.9,
                  }}
                />
                <span className="mt-1 block text-center text-[8px] leading-none text-dim">
                  {index % 2 === 0 || index === daily.length - 1 ? day.day.slice(8) : ""}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[9.5px] text-dim">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-lime" /> anúncios novos
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber" /> dia com falha
            </span>
            <span className="ml-auto">
              {latencySeries.length >= 2 ? (
                <span className="inline-flex items-center gap-2">
                  tempo médio por dia
                  <span className="w-20">
                    <Sparkline data={latencySeries} color="#9a86ff" height={18} />
                  </span>
                </span>
              ) : (
                "tempo médio: sem série suficiente"
              )}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-dim">
            Falhas e latência por fonte · 30 dias
          </p>
          {health.length === 0 ? (
            <p className="text-[11px] text-dim">
              Nenhuma execução registrada ainda. Sincronize uma fonte para começar a medir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-dim">
                    <th className="pb-1.5 font-medium">Fonte</th>
                    <th className="pb-1.5 text-right font-medium">Execuções</th>
                    <th className="pb-1.5 text-right font-medium">Falhas</th>
                    <th className="pb-1.5 pl-3 font-medium">Taxa de falha</th>
                    <th className="pb-1.5 text-right font-medium">Novos</th>
                    <th className="pb-1.5 text-right font-medium">Média</th>
                    <th className="pb-1.5 text-right font-medium">p95</th>
                    <th className="pb-1.5 pl-3 font-medium">Último erro</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-muted">
                  {health.map((item) => (
                    <tr key={item.source} className="border-t border-line-soft">
                      <td className="py-1.5">
                        <span className="font-medium text-fg">{item.source}</span>
                        {item.skipped > 0 && (
                          <span className="ml-1.5 text-[9.5px] text-dim">{item.skipped} pulada(s)</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{item.runs}</td>
                      <td className={`py-1.5 text-right tabular-nums ${item.errors > 0 ? "text-rose" : ""}`}>
                        {item.errors}
                      </td>
                      <td className="w-[130px] py-1.5 pl-3">
                        <div className="flex items-center gap-1.5">
                          <span className="flex-1">
                            <Progress
                              value={item.errorRate}
                              color={item.errorRate === 0 ? "#a3f04b" : item.errorRate < 34 ? "#f5b841" : "#f2607a"}
                            />
                          </span>
                          <span className="w-[36px] shrink-0 text-right text-[10px] tabular-nums text-dim">
                            {item.errorRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{item.inserted}</td>
                      <td className="py-1.5 text-right tabular-nums">{item.avgMs ? `${item.avgMs} ms` : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{item.p95Ms ? `${item.p95Ms} ms` : "—"}</td>
                      <td className="max-w-[240px] truncate py-1.5 pl-3 text-[10px] text-dim">
                        {item.lastError ? `${item.lastError} · ${relativeTime(item.lastErrorAt)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-dim">
            Taxa de falha = execuções com erro ÷ execuções no período. p95 é o tempo de resposta que 95% das
            execuções ficaram abaixo — se ele sobe muito acima da média, a fonte está estrangulando.
          </p>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Leitura da IA"
          hint="Gerada junto de cada sincronização — o que entrou, o ângulo e o teste sugerido"
        />

        {!insightsOn && (
          <p className="mb-2 rounded-lg border border-line-soft bg-[#0b1219] px-3 py-2 text-[10.5px] text-dim">
            Leitura desligada por RADAR_INSIGHTS=off — a coleta continua normalmente.
          </p>
        )}

        {insights.length === 0 ? (
          <p className="rounded-lg border border-line-soft bg-[#0b1219] px-3 py-3 text-[11px] text-dim">
            Nenhuma leitura ainda. Ela aparece depois da primeira sincronização que trouxer anúncio novo.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li key={insight.id} className="rounded-lg border border-line-soft bg-[#0b1219] px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="lime">{sourceLabel(insight.source)}</Badge>
                  <Badge tone={insight.simulated ? "amber" : "violet"}>
                    {insight.simulated ? "simulação" : insight.model}
                  </Badge>
                  <span className="text-[10px] text-dim">{insight.ads} anúncio(s) novo(s)</span>
                  <span className="ml-auto text-[10px] tabular-nums text-dim">{dateTime(insight.created_at)}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{insight.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Importar anúncios"
          hint="Array JSON no formato do Radar — o caminho para base brasileira"
        />
        <form action={syncAction} className="space-y-2">
          <input type="hidden" name="source" value="import" />
          <textarea
            name="json"
            rows={7}
            required
            className="textarea font-mono text-[11px]"
            placeholder={`[
  {
    "id": "ad-123",
    "advertiser": "Minha Loja",
    "headline": "Coleção verão com 30% OFF",
    "body": "Grade fechada, 12 peças por R$ 349. Envio para todo o Brasil.",
    "cta": "Comprar agora",
    "landing_url": "https://minhaloja.com.br/verao",
    "landing_title": "Coleção verão — Minha Loja",
    "tech_stack": "Shopify,Meta Pixel",
    "network": "instagram",
    "country": "BR",
    "language": "pt",
    "media_type": "video",
    "likes": 1240,
    "comments": 88,
    "shares": 41,
    "start_date": "2026-09-02"
  }
]`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" type="submit">
              <Upload size={13} /> Importar
            </button>
            <span className="text-[10px] text-dim">
              Campos aceitos em português também: anunciante, texto, titulo, curtidas, comentarios.
            </span>
          </div>
        </form>
      </Card>

      <Card>
        <SectionHeader title="Cobertura real, sem promessa" hint="O que existe hoje por API oficial" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-dim">
                <th className="pb-2 font-medium">Fonte</th>
                <th className="pb-2 font-medium">Anúncio comercial no Brasil</th>
                <th className="pb-2 font-medium">Anúncio comercial na UE</th>
                <th className="pb-2 font-medium">Anúncio político no Brasil</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-t border-line-soft">
                <td className="py-1.5">Meta Ad Library</td>
                <td className="py-1.5 text-rose">não</td>
                <td className="py-1.5 text-lime">sim</td>
                <td className="py-1.5 text-lime">sim</td>
              </tr>
              <tr className="border-t border-line-soft">
                <td className="py-1.5">TikTok Commercial Content</td>
                <td className="py-1.5 text-rose">não</td>
                <td className="py-1.5 text-lime">sim</td>
                <td className="py-1.5 text-dim">—</td>
              </tr>
              <tr className="border-t border-line-soft">
                <td className="py-1.5">Microsoft Ad Library</td>
                <td className="py-1.5 text-rose">não</td>
                <td className="py-1.5 text-lime">sim</td>
                <td className="py-1.5 text-dim">—</td>
              </tr>
              <tr className="border-t border-line-soft">
                <td className="py-1.5">Importação própria</td>
                <td className="py-1.5 text-lime">sim, com o que você fornecer</td>
                <td className="py-1.5 text-lime">sim</td>
                <td className="py-1.5 text-lime">sim</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-dim">
          Nenhuma API oficial entrega anúncio comercial brasileiro do Meta, TikTok, Google, LinkedIn ou Pinterest. Quem
          promete isso em volume está raspando a Ad Library fora dos termos de uso — o risco (bloqueio de conta, remoção
          de dados, exposição jurídica) fica com quem assina. Aqui a base brasileira entra por importação rastreável e a
          cobertura internacional vem de API documentada.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Histórico de sincronização" hint="Toda execução fica registrada" />
          <div className="space-y-1">
            {history.map((row) => (
              <div key={row.id} className="flex items-center gap-2 border-b border-line-soft py-1.5 last:border-0 text-[10.5px]">
                <Badge tone={row.status === "ok" ? "lime" : row.status === "skipped" ? "amber" : "rose"}>{row.status}</Badge>
                <span className="font-medium">{row.source}</span>
                <span className="text-dim">
                  {row.inserted}+ {row.updated}~ · {row.duration_ms ?? 0} ms
                </span>
                <span className="ml-auto text-dim">{relativeTime(row.finished_at ?? row.started_at)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="API do Radar" hint="O que o AdSpy não tem" />
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
              GET /api/radar/ads?q=atacado&ordem=score&pagina=1
            </code>
            <CopyButton value="GET /api/radar/ads?q=atacado&ordem=score&pagina=1" />
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-dim">
            Retorna JSON paginado com os mesmos filtros da interface. Se <code className="text-muted">RADAR_API_KEY</code>{" "}
            estiver definida, exige o header <code className="text-muted">x-api-key</code>. Sem a variável, a rota fica
            aberta para você testar.
          </p>
          <div className="mt-2 rounded-lg border border-line-soft bg-[#0b1219] p-2">
            <p className="flex items-center gap-1.5 text-[10px] text-muted">
              <KeyRound size={10} /> Exemplo
            </p>
            <code className="mt-1 block break-all text-[10px] text-dim">
              curl -H &quot;x-api-key: $RADAR_API_KEY&quot; &quot;/api/radar/ads?marca=Atacado&amp;durMin=60&quot;
            </code>
          </div>
        </Card>
      </div>
    </div>
  );
}
