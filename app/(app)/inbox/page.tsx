import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Search,
  Send,
  SkipForward,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import { AiModeSelect } from "@/components/inbox/ai-mode-select";
import { Composer } from "@/components/inbox/composer";
import { StageSelect } from "@/components/inbox/stage-select";
import { ScrollToBottom } from "@/components/scroll-to-bottom";
import { Avatar, Badge, Card, Score } from "@/components/ui";
import { skipFollowupAction, sendFollowupAction, qualifyAction } from "@/lib/actions";
import { brl, clockTime, dayLabel, formatPhone, relativeTime } from "@/lib/format";
import {
  getFollowups,
  getLead,
  getMessages,
  getOrders,
  listConversations,
} from "@/lib/queries";
import { VERTICALS, renderTemplate, scoreBand, verticalBySlug } from "@/lib/verticals";
import { parseStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; q?: string; vertical?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").toLowerCase().trim();
  const verticalFilter = params.vertical ?? "";

  const conversations = listConversations().filter((conversation) => {
    if (verticalFilter && conversation.lead.vertical !== verticalFilter) return false;
    if (!query) return true;
    return (
      conversation.lead.name.toLowerCase().includes(query) ||
      conversation.lead.phone.includes(query) ||
      conversation.lastMessage.toLowerCase().includes(query)
    );
  });

  const selectedId = Number(params.lead) || conversations[0]?.lead.id;
  const lead = selectedId ? getLead(selectedId) : undefined;
  const messages = lead ? getMessages(lead.id) : [];
  const followups = lead ? getFollowups(lead.id) : [];
  const orders = lead ? getOrders(lead.id) : [];
  const vertical = lead ? verticalBySlug(lead.vertical) : undefined;
  const answers = lead ? (JSON.parse(lead.answers || "{}") as Record<string, string>) : {};
  const band = lead ? scoreBand(lead.score) : undefined;

  const suggestions =
    vertical && lead
      ? vertical.cadence.map((step) => ({
          label: step.label,
          text: renderTemplate(step.template, {
            primeiro_nome: lead.name.split(" ")[0],
            nome: lead.name,
            vendedor: lead.owner.split(" ")[0],
            empresa: "PRISMA IA",
            bairro: lead.city ?? "seu bairro",
            peca: "nossa peça",
            procedimento: answers[vertical.qualification[0].key] ?? "o procedimento",
            veiculo: "o veículo",
          }),
        }))
      : [];

  return (
    <div className="mx-auto flex h-[calc(100vh-48px)] max-w-[1500px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Conversas</h1>
          <p className="text-[12px] text-muted">
            {conversations.length} conversas · resposta média de {conversations.length ? "3" : "0"} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/inbox" className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar lead ou mensagem"
              className="input h-8 w-[230px] pl-8 text-[12px]"
            />
            {verticalFilter && <input type="hidden" name="vertical" value={verticalFilter} />}
          </form>
          <form action="/inbox" className="flex items-center gap-1">
            <select name="vertical" defaultValue={verticalFilter} className="select h-8 w-auto py-0 text-[11.5px]">
              <option value="">Todos os nichos</option>
              {VERTICALS.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.short}
                </option>
              ))}
            </select>
            {params.q && <input type="hidden" name="q" value={params.q} />}
            <button className="btn h-8 px-2.5" type="submit">
              <ChevronRight size={13} />
            </button>
          </form>
          <Link href="/leads/novo" className="btn btn-primary h-8">
            <MessageSquare size={13} /> Nova conversa
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[286px_minmax(0,1fr)_306px]">
        {/* lista */}
        <Card padded={false} className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[10.5px] uppercase tracking-wider text-dim">
            <span>Fila de atendimento</span>
            <span>{conversations.length}</span>
          </div>
          <div className="scroll-area min-h-0 flex-1">
            {conversations.map((conversation) => {
              const item = conversation.lead;
              const active = item.id === selectedId;
              const itemVertical = verticalBySlug(item.vertical);
              return (
                <Link
                  key={item.id}
                  href={`/inbox?lead=${item.id}${params.q ? `&q=${params.q}` : ""}${verticalFilter ? `&vertical=${verticalFilter}` : ""}`}
                  className={`flex items-start gap-2.5 border-b border-line-soft px-3 py-2.5 transition-colors ${active ? "bg-[#151f29]" : "hover:bg-[#101923]"}`}
                >
                  <Avatar name={item.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium">{item.name}</span>
                      {conversation.unread > 0 && <span className="size-1.5 shrink-0 rounded-full bg-lime" />}
                      <span className="ml-auto shrink-0 text-[10px] text-dim">
                        {relativeTime(conversation.lastAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-dim">{conversation.lastMessage}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: itemVertical?.color }}
                        title={itemVertical?.name}
                      />
                      <span className="text-[10px] text-dim">{itemVertical?.short}</span>
                      <span className="ml-auto">
                        <Score value={item.score} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {conversations.length === 0 && (
              <p className="px-3 py-8 text-center text-[12px] text-dim">Nenhuma conversa encontrada.</p>
            )}
          </div>
        </Card>

        {/* thread */}
        {lead ? (
          <Card padded={false} className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
              <Avatar name={lead.name} size={32} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-medium">{lead.name}</p>
                  {band && (
                    <>\n                      <Badge tone={band.tone}>{band.label}</Badge>\n                      {band.action && (\n                        <div className="ml-2 text-[10px] text-dim whitespace-break-all" title={band.action}>\n                          {band.action.substring(0, 50)}{band.action.length > 50 ? "..." : ""}\n                        </div>\n                      )}\n                      {band.followupDays !== undefined && (\n                        <div className="ml-2 text-[10px] text-dim">FN {band.followupDays}d</div>\n                      )}\n                    </>\n                  )}\n                </div>\n                <p className=\"text-[10.5px] text-dim\">\n                  {formatPhone(lead.phone)} · {vertical?.short} · {lead.source}\n                </p>\n              </div>\n              <div className="ml-auto flex items-center gap-1.5">\n                <AiModeSelect leadId={lead.id} mode={lead.ai_mode ?? "copilot"} />\n                <StageSelect\n                  leadId={lead.id}\n                  stage={lead.stage}\n                  options={vertical?.stages.map((stage) => ({ key: stage.key, label: stage.label })) ?? []}\n                />\n              </div>\n            </div>\n\n            <ScrollToBottom className="scroll-area min-h-0 flex-1 space-y-1 bg-[#0a1016] px-3 py-3">\n              {messages.map((message, index) => {\n                const previous = messages[index - 1];\n                const showDay =\n                  !previous ||\n                  parseStamp(previous.created_at).toDateString() !== parseStamp(message.created_at).toDateString();\n                return (\n                  <div key={message.id}>\n                    {showDay && (\n                      <div className=\"my-2 flex justify-center\">\n                        <span className=\"rounded-full bg-[#141d26] px-2 py-0.5 text-[10px] text-dim\">\n                          {dayLabel(message.created_at)}\n                        </span>\n                      </div>\n                    )}\n                    <div className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`,}>\n                      <div\n                        className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[12px] leading-relaxed ${message.direction === "out" ? "rounded-br-sm bg-[#1d3520] text-[#e8ffd8]" : "rounded-bl-sm bg-[#141d26] text-fg"}`,}\n                      >\n                        <p className="whitespace-pre-wrap">{message.body}</p>\n                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-white/35">\n                          {message.author === "ai" && (\n                            <span className="inline-flex items-center gap-0.5 text-lime/70">\n                              <Sparkles size={8} /> IA\n                            </span>\n                          )}\n                          {message.template_key && message.author !== "ai" && (\n                            <span className="inline-flex items-center gap-0.5">\n                              <Sparkles size={8} /> {message.template_key}\n                            </span>\n                          )}\n                          <span>{clockTime(message.created_at)}</span>\n                          {message.direction === "out" && (\n                            <span className={message.status === "failed" ? "text-rose" : "text-lime/60"}>\n                              {message.status === "failed" ? "falhou" : "✓✓"}\n                            </span>\n                          )}\n                        </div>\n                      </div>\n                    </div>\n                  </div>\n                );\n              })}\n              {messages.length === 0 && (\n                <p className="py-10 text-center text-[12px] text-dim">Nenhuma mensagem ainda.</p>\n              )}\n            </ScrollToBottom>\n\n            <Composer leadId={lead.id} suggestions={suggestions} aiMode={lead.ai_mode ?? "copilot"} />\n          </Card>\n        ) : (\n          <Card className="grid place-items-center text-[12.5px] text-dim">Selecione uma conversa</Card>\n        )}\n\n        {/* painel do lead */}\n        <div className="scroll-area min-h-0 space-y-3 overflow-y-auto pr-0.5">\n          {lead && vertical && (\n            <>\n              <Card>\n                <div className="flex items-center justify-between">\n                  <p className=\"text-[11px] font-semibold uppercase tracking-wider text-dim\">Qualificação</p>\n                  <Badge tone={band?.tone ?? "neutral"}>score {lead.score}</Badge>\n                </div>\n                <form action={qualifyAction} className="mt-2.5 space-y-2.5">\n                  <input type=\"hidden\" name=\"leadId\" value={lead.id} />\n                  {vertical.qualification.map((question) => (\n                    <div key={question.key}>\n                      <label className=\"label mb-1\">{question.label}</label>\n                      <select name={`q_${question.key}`} defaultValue={answers[question.key] ?? ""} className=\"select\">\n                        <option value=\"\">Não perguntado</option>\n                        {question.options.map((option) => (\n                          <option key={option.label} value={option.label}>\n                            {option.label}\n                          </option>\n                        ))}\n                      </select>\n                    </div>\n                  ))}\n                  <button className=\"btn w-full\" type=\"submit\">\n                    Recalcular score\n                  </button>\n                </form>\n              </Card>\n\n              <Card>\n                <p className=\"text-[11px] font-semibold uppercase tracking-wider text-dim\">Ficha do lead</p>\n                <dl className=\"mt-2 space-y-1.5 text-[11.5px]\">\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Valor potencial</dt>\n                    <dd className=\"tabular-nums\">{brl(lead.value)}</dd>\n                  </div>\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Responsável</dt>\n                    <dd>{lead.owner}</dd>\n                  </div>\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Origem</dt>\n                    <dd className=\"truncate text-right\">{lead.source}</dd>\n                  </div>\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Cidade</dt>\n                    <dd>{lead.city ?? "—"}</dd>\n                  </div>\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Entrou em</dt>\n                    <dd>{dayLabel(lead.created_at)}</dd>\n                  </div>\n                  <div className=\"flex justify-between gap-2\">\n                    <dt className=\"text-dim\">Último contato</dt>\n                    <dd>{relativeTime(lead.last_inbound_at ?? lead.last_outbound_at)}</dd>\n                  </div>\n                </dl>\n                <div className=\"mt-2.5 flex flex-wrap gap-1\">\n                  <span className=\"chip\">\n                    <Tag size={10} /> {vertical.short}\n                  </span>\n                  <span className=\"chip\">\n                    <UserRound size={10} /> opt-in\n                  </span>\n                </div>\n              </Card>\n\n              <Card padded={false}>\n                <div className="flex items-center justify-between px-4 py-2.5">\n                  <p className=\"text-[11px] font-semibold uppercase tracking-wider text-dim\">Cadência</p>\n                  <span className=\"text-[10.5px] text-dim\">{followups.filter((f) => f.status === "pending").length} pendentes</span>\n                </div>\n                <div className=\"border-t border-line-soft\">\n                  {followups.slice(0, 4).map((followup) => {\n                    const step = vertical.cadence[followup.step];\n                    return (\n                      <div key={followup.id} className="border-b border-line-soft px-4 py-2 last:border-0">\n                        <div className="flex items-center gap-1.5">\n                          <span className=\"text-[11.5px] font-medium\">\n                            {step?.label ?? `Etapa ${followup.step + 1}`}\n                          </span>\n                          <Badge tone={followup.status === "pending" ? "amber" : "neutral"}>\n                            {followup.status === "pending" ? `D+${step?.day ?? "?"}` : followup.status}\n                          </Badge>\n                        </div>\n                        <p className="mt-1 line-clamp-2 text-[10.5px] text-dim">{followup.template}</p>\n                        {followup.status === "pending" && (\n                          <div className="mt-1.5 flex gap-1.5">\n                            <form action={sendFollowupAction}>\n                              <input type=\"hidden\" name=\"followupId\" value={followup.id} />\n                              <button className=\"btn h-6 px-2 text-[10.5px]\" type=\"submit\">\n                                <Send size={10} /> Enviar\n                              </button>\n                            </form>\n                            <form action={skipFollowupAction}>\n                              <input type=\"hidden\" name=\"followupId\" value={followup.id} />\n                              <button className=\"btn btn-ghost h-6 px-2 text-[10.5px]\" type=\"submit\">\n                                <SkipForward size={10} /> Pular\n                              </button>\n                            </form>\n                          </div>\n                        )\n                      </div>\n                    );\n                  })}\n                  {followups.length === 0 && (\n                    <p className="px-4 py-4 text-center text-[11px] text-dim">Nenhum follow-up agendado.</p>\n                  )}\n                </div>\n              </Card>\n\n              {orders.length > 0 && (\n                <Card padded={false}>\n                  <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-dim">\n                    Pedidos\n                  </div>\n                  <div className=\"border-t border-line-soft\">\n                    {orders.map((order) => (\n                      <Link\n                        key={order.id}\n                        href=\"/operacoes\"\n                        className=\"flex items-center justify-between border-b border-line-soft px-4 py-2 text-[11.5px] last:border-0 hover:bg-[#101923]\"\n                      >\n                        <div>\n                          <p className=\"font-medium\">{order.code}</p>\n                          <p className=\"text-[10px] text-dim\">{brl(order.total)}</p>\n                        </div>\n                        <div className="flex items-center gap-1.5">\n                          <Badge tone={order.status === "entregue" ? "lime" : order.status === "enviado" ? "cyan" : "amber"}>\n                            {order.status}\n                          </Badge>\n                          <ExternalLink size={11} className=\"text-dim\" />\n                        </div>\n                      </Link>\n                    ))\n                  </div>\n                </Card>\n              )}\n            </>\n          </div>\n        </div>\n      </div>\n    </div>\n  );
}