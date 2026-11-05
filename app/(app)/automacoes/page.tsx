import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, Send, SkipForward, Users, Zap } from "lucide-react";
import { RunCadenceButton } from "@/components/run-cadence-button";
import { Badge, Card, PageHeader, Progress, SectionHeader, Stat } from "@/components/ui";
import {
  createBroadcastAction,
  sendFollowupAction,
  skipFollowupAction,
} from "@/lib/actions";
import { dateTime, relativeTime } from "@/lib/format";
import { getDb } from "@/lib/db";
import { listBroadcasts, listLeads } from "@/lib/queries";
import { VERTICALS, verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default async function AutomacoesPage() {
  const db = getDb();
  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM followups WHERE status = 'pending'")
    .get() as { n: number };
  const overdue = db
    .prepare("SELECT COUNT(*) AS n FROM followups WHERE status = 'pending' AND due_at <= datetime('now')")
    .get() as { n: number };
  const sentToday = db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE direction = 'out' AND date(created_at) = date('now')")
    .get() as { n: number };
  const done = db
    .prepare("SELECT COUNT(*) AS n FROM followups WHERE status = 'done'")
    .get() as { n: number };

  const due = db
    .prepare(
      `SELECT f.id, f.due_at, f.step, f.template, l.id AS lead_id, l.name, l.vertical, l.score
       FROM followups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.due_at <= datetime('now')
       ORDER BY f.due_at ASC LIMIT 12`,
    )
    .all() as {
    id: number;
    due_at: string;
    step: number;
    template: string;
    lead_id: number;
    name: string;
    vertical: string;
    score: number;
  }[];

  const upcoming = db
    .prepare(
      `SELECT f.id, f.due_at, f.step, f.template, l.id AS lead_id, l.name, l.vertical
       FROM followups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.due_at > datetime('now')
       ORDER BY f.due_at ASC LIMIT 8`,
    )
    .all() as { id: number; due_at: string; step: number; template: string; lead_id: number; name: string; vertical: string }[];

  const broadcasts = listBroadcasts();
  const optedIn = listLeads({ limit: 1000 }).filter((lead) => lead.opted_in);
  const segments = VERTICALS.map((vertical) => ({
    vertical,
    count: optedIn.filter((lead) => lead.vertical === vertical.slug).length,
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Automação"
        title="Cadências e disparos"
        description="Motor de follow-up por etapa do funil, com trava de opt-in e limite por hora para proteger o número."
        actions={<RunCadenceButton />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Follow-ups pendentes" value={String(pending.n)} hint={`${overdue.n} vencidos agora`} tone="violet" icon={<CalendarClock size={14} />} />
        <Stat label="Enviados hoje" value={String(sentToday.n)} hint="Mensagens de saída" tone="lime" icon={<Send size={14} />} />
        <Stat label="Concluídos" value={String(done.n)} hint="Follow-ups já disparados" tone="cyan" icon={<CheckCircle2 size={14} />} />
        <Stat label="Base opt-in" value={String(optedIn.length)} hint={`${segments.filter((s) => s.count > 0).length} nichos ativos`} tone="neutral" icon={<Users size={14} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7" padded={false}>
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <SectionHeader title="Fila de disparo imediato" hint={`${overdue.n} mensagens vencidas`} />
            <Badge tone="amber" dot>
              motor ativo
            </Badge>
          </div>
          <div className="border-t border-line">
            {due.map((row) => {
              const vertical = verticalBySlug(row.vertical);
              const step = vertical?.cadence[row.step];
              return (
                <div key={row.id} className="border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-[#101923]">
                  <div className="flex items-center gap-2">
                    <Link href={`/inbox?lead=${row.lead_id}`} className="text-[12px] font-medium hover:text-lime">
                      {row.name}
                    </Link>
                    <span className="text-[10.5px] text-dim">{vertical?.short}</span>
                    <Badge tone="amber">D+{step?.day ?? "?"}</Badge>
                    <Badge tone="neutral">score {row.score}</Badge>
                    <span className="ml-auto text-[10.5px] text-dim">venceu {relativeTime(row.due_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{row.template}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <form action={sendFollowupAction}>
                      <input type="hidden" name="followupId" value={row.id} />
                      <button className="btn h-6 px-2 text-[10.5px]" type="submit">
                        <Send size={10} /> Enviar agora
                      </button>
                    </form>
                    <form action={skipFollowupAction}>
                      <input type="hidden" name="followupId" value={row.id} />
                      <button className="btn btn-ghost h-6 px-2 text-[10.5px]" type="submit">
                        <SkipForward size={10} /> Pular etapa
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            {due.length === 0 && (
              <p className="px-5 py-10 text-center text-[12px] text-dim">
                Nada vencido. Rode o motor novamente quando houver follow-ups no prazo.
              </p>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-5" padded={false}>
          <div className="px-5 pb-2 pt-5">
            <SectionHeader title="Próximos na agenda" hint="Agendados para os próximos dias" />
          </div>
          <div className="border-t border-line">
            {upcoming.map((row) => (
              <div key={row.id} className="flex items-center gap-2 border-b border-line-soft px-5 py-2 text-[11.5px] last:border-0">
                <Clock3 size={11} className="text-dim" />
                <span className="truncate">{row.name}</span>
                <span className="text-[10px] text-dim">{verticalBySlug(row.vertical)?.short}</span>
                <span className="ml-auto shrink-0 text-[10.5px] text-dim">{dateTime(row.due_at)}</span>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="px-5 py-8 text-center text-[12px] text-dim">Nenhum follow-up agendado.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <SectionHeader
          title="Cadências por nicho"
          hint="Cada nicho tem número de toques, dias e objetivo próprios. Clique para expandir."
        />
        <div className="grid gap-2 lg:grid-cols-3">
          {VERTICALS.map((vertical) => (
            <details key={vertical.slug} className="group rounded-xl border border-line bg-[#0b1219] p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: vertical.color }} />
                <span className="text-[12px] font-medium">{vertical.short}</span>
                <span className="ml-auto text-[10px] text-dim">{vertical.cadence.length} toques</span>
              </summary>
              <ol className="mt-2.5 space-y-2">
                {vertical.cadence.map((step, index) => (
                  <li key={step.label} className="border-l border-line pl-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium">
                        {index + 1}. {step.label}
                      </span>
                      <Badge tone="neutral">D+{step.day}</Badge>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-dim">{step.template}</p>
                    <p className="mt-0.5 text-[9.5px] uppercase tracking-wider text-dim/70">{step.goal}</p>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <SectionHeader
            title="Disparo em massa"
            hint="Segmento por nicho e etapa · apenas leads com opt-in"
            action={<Badge tone="rose">trava antispam</Badge>}
          />
          <form action={createBroadcastAction} className="space-y-2.5">
            <div>
              <label className="label">Nome da campanha</label>
              <input name="name" required className="input" placeholder="Ex.: Reativação coleção primavera" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Nicho</label>
                <select name="vertical" className="select">
                  <option value="">Todos</option>
                  {VERTICALS.map((vertical) => (
                    <option key={vertical.slug} value={vertical.slug}>
                      {vertical.short} ({segments.find((s) => s.vertical.slug === vertical.slug)?.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Etapa</label>
                <select name="stage" className="select">
                  <option value="">Todas</option>
                  {VERTICALS[0].stages.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Mensagem</label>
              <textarea
                name="template"
                required
                rows={3}
                className="textarea resize-none"
                defaultValue="Oi {primeiro_nome}! Separei uma condição especial para você nessa semana. Quer que eu te mande os detalhes?"
              />
              <p className="mt-1 text-[10px] text-dim">
                Variáveis: {"{primeiro_nome}"}, {"{nome}"}, {"{empresa}"}, {"{vendedor}"}
              </p>
            </div>
            <button className="btn btn-primary w-full" type="submit">
              <Zap size={13} /> Enfileirar disparo
            </button>
            <p className="text-[10px] leading-relaxed text-dim">
              Limite de 200 contatos por disparo e 1 mensagem por lead a cada 24h. Números em sandbox não enviam
              nada de verdade.
            </p>
          </form>
        </Card>

        <Card className="xl:col-span-6" padded={false}>
          <div className="px-5 pb-2 pt-5">
            <SectionHeader title="Campanhas recentes" hint="Entrega e alcance por disparo" />
          </div>
          <div className="divide-y divide-[#172029] border-t border-line">
            {broadcasts.map((broadcast) => {
              const vertical = broadcast.vertical ? verticalBySlug(broadcast.vertical) : undefined;
              return (
                <div key={broadcast.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-medium">{broadcast.name}</p>
                    <Badge tone={broadcast.status === "concluido" ? "lime" : "amber"}>{broadcast.status}</Badge>
                    <span className="ml-auto text-[10.5px] text-dim">{relativeTime(broadcast.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-dim">
                    {vertical?.short ?? "Todos os nichos"} ·{" "}
                    {broadcast.stage_filter ? `etapa ${broadcast.stage_filter}` : "todas as etapas"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={(broadcast.sent / Math.max(1, broadcast.total)) * 100} />
                    <span className="shrink-0 text-[10.5px] tabular-nums text-dim">
                      {broadcast.sent}/{broadcast.total}
                    </span>
                  </div>
                </div>
              );
            })}
            {broadcasts.length === 0 && (
              <p className="px-5 py-8 text-center text-[12px] text-dim">Nenhuma campanha ainda.</p>
            )}
          </div>
        </Card>
      </div>

      <p className="pb-2 text-[10.5px] leading-relaxed text-dim">
        Regra de ouro: fora da janela de 24h da conversa, a Cloud API exige template aprovado pela Meta. Em sandbox
        o envio é apenas registrado no banco — custo zero e nenhum risco de bloqueio do número.
      </p>
    </div>
  );
}
