import { getDb } from "./db";
import { nowStamp } from "./format";
import { sendWhatsAppText } from "./whatsapp";
import { verticalBySlug, type Vertical } from "./verticals";
import { buildContextBlock, buildSystemPrompt, shouldEscalate } from "./ai-persona";

export type AiConfig = {
  configured: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  key?: string;
};

/** Qualquer endpoint compatível com OpenAI serve: Z.ai, Freebuff, OpenAI, Groq… */
export function getAiConfig(): AiConfig {
  const key =
    process.env.AI_API_KEY?.trim() ||
    process.env.ZAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined;

  const isZai = Boolean(process.env.ZAI_API_KEY?.trim());
  const baseUrl =
    process.env.AI_API_BASE?.trim() || (isZai ? "https://api.z.ai/api/paas/v4" : "https://freebuff.com/api/v1/paid");
  const model = process.env.AI_MODEL?.trim() || (isZai ? "glm-4-flash" : "glm-4-flash");

  return {
    configured: Boolean(key),
    provider: isZai ? "Z.ai" : process.env.AI_API_KEY ? "Compatível OpenAI" : "Freebuff",
    model,
    baseUrl,
    key,
  };
}

export type Draft = {
  text: string;
  model: string;
  simulated: boolean;
  handoff: boolean;
  error?: string;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function trimReply(value: string): string {
  return value
    .replace(/^\[HUMANO\]\s*/i, "")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, 900);
}

export async function callModel(messages: ChatMessage[], config: AiConfig): Promise<{ text: string; error?: string }> {
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.65,
        top_p: 0.9,
        max_tokens: 400,
        messages,
      }),
    });

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return { text: "", error: data?.error?.message ?? `Provedor de IA respondeu ${response.status}` };
    }
    return { text: data.choices?.[0]?.message?.content ?? "" };
  } catch (error) {
    return { text: "", error: (error as Error).message };
  }
}

/** Plano B determinístico: mantém o tom e a técnica mesmo sem chave de IA. */
function simulatedDraft(
  vertical: Vertical,
  leadName: string,
  history: { direction: string; body: string }[],
  stageLabel: string,
): string {
  const lastInbound = [...history].reverse().find((message) => message.direction === "in")?.body ?? "";
  const text = lastInbound.toLowerCase();
  const first = leadName.split(" ")[0];

  // intenção primeiro: preço e prazo são as perguntas que mais aparecem
  if (/quanto|pre[çc]o|valor|custa|m[íi]nimo/.test(text)) {
    return `${first}, o valor depende do volume e do mix — prefiro te passar o número certo, não um chute. Quantas peças (ou qual quantidade) você pretende no primeiro pedido?`;
  }
  if (/entrega|prazo|semana|quando|chega|frete/.test(text)) {
    return `${first}, consigo confirmar a data exata para o seu endereço. Me diz a cidade e a quantidade que eu já te respondo com o prazo real — a média deste tipo de pedido é ${vertical.playbook.cycle}.`;
  }
  if (/foto|fotos|catálogo|catalogo|v[íi]deo/.test(text)) {
    return `Claro, ${first}! Te mando as fotos e os detalhes agora. Só me confirma uma coisa: você quer para uso próprio ou para revender?`;
  }
  if (/onde|endere[çc]o|localiza/.test(text)) {
    return `${first}, te passo o endereço certinho e o melhor horário para você ser atendido sem espera. Prefere manhã ou tarde?`;
  }

  const objection = vertical.playbook.objections.find((item) => {
    const head = item.q.toLowerCase().split(" ").slice(0, 2).join(" ");
    return head.length > 3 && text.includes(head);
  });
  if (objection) {
    return `${first}, ${objection.a.charAt(0).toLowerCase()}${objection.a.slice(1)}`;
  }
  return `Oi ${first}, tudo bem? Para eu te ajudar de verdade e não te empurrar nada: o que você precisa resolver primeiro? Assim eu já te mostro a opção que faz sentido para o seu momento (${stageLabel.toLowerCase()}).`;
}

function buildHistory(messages: { direction: string; body: string }[]): ChatMessage[] {
  return messages.slice(-12).map((message) => ({
    role: message.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: message.body,
  }));
}

export async function draftReply(leadId: number, business = "nossa empresa"): Promise<Draft> {
  const db = getDb();
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as
    | {
        id: number;
        name: string;
        vertical: string;
        score: number;
        stage: string;
        answers: string;
      }
    | undefined;

  if (!lead) return { text: "", model: "—", simulated: false, handoff: false, error: "Lead não encontrado" };

  const vertical = verticalBySlug(lead.vertical);
  if (!vertical) {
    return { text: "", model: "—", simulated: false, handoff: false, error: "Nicho desconhecido" };
  }

  const history = db
    .prepare("SELECT direction, body FROM messages WHERE lead_id = ? ORDER BY created_at ASC, id ASC")
    .all(leadId) as { direction: string; body: string }[];

  const answers = JSON.parse(lead.answers || "{}") as Record<string, string>;
  const stageLabel = vertical.stages.find((stage) => stage.key === lead.stage)?.label ?? lead.stage;
  const lastInbound = [...history].reverse().find((message) => message.direction === "in")?.body ?? "";
  const config = getAiConfig();

  if (!config.configured) {
    return {
      text: simulatedDraft(vertical, lead.name, history, stageLabel),
      model: "simulador local",
      simulated: true,
      handoff: shouldEscalate(lastInbound),
    };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(vertical, business) },
    {
      role: "system",
      content: buildContextBlock({
        name: lead.name,
        score: lead.score,
        stage: lead.stage,
        stageLabel,
        answers,
        cashbackLabel: vertical.cashback.label,
      }),
    },
    ...buildHistory(history),
  ];

  const { text, error } = await callModel(messages, config);
  if (!text.trim()) {
    return {
      text: simulatedDraft(vertical, lead.name, history, stageLabel),
      model: "simulador local",
      simulated: true,
      handoff: shouldEscalate(lastInbound),
      error,
    };
  }

  const handoff = /\[HUMANO\]/i.test(text) || shouldEscalate(lastInbound);
  return {
    text: trimReply(text),
    model: config.model,
    simulated: false,
    handoff,
  };
}

export function getAiSettings(): { auto: boolean; mode: string } {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('ai_auto','ai_mode')").all() as {
    key: string;
    value: string;
  }[];
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { auto: map.ai_auto === "on", mode: map.ai_mode ?? "copilot" };
}

export function setAiSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

/** Chamado pelo webhook: responde sozinho quando o lead está em modo automático. */
export async function maybeAutoReply(leadId: number): Promise<{ replied: boolean; reason?: string }> {
  const db = getDb();
  const settings = getAiSettings();
  if (!settings.auto) return { replied: false, reason: "automação desligada" };

  const lead = db.prepare("SELECT ai_mode FROM leads WHERE id = ?").get(leadId) as { ai_mode: string } | undefined;
  if (!lead) return { replied: false, reason: "lead inexistente" };
  if (lead.ai_mode !== "auto") return { replied: false, reason: `modo ${lead.ai_mode}` };

  const lastInbound = db
    .prepare("SELECT body, created_at FROM messages WHERE lead_id = ? AND direction = 'in' ORDER BY created_at DESC LIMIT 1")
    .get(leadId) as { body: string; created_at: string } | undefined;
  if (!lastInbound) return { replied: false, reason: "sem mensagem recebida" };

  // não responde duas vezes à mesma mensagem
  const lastOutbound = db
    .prepare("SELECT created_at FROM messages WHERE lead_id = ? AND direction = 'out' ORDER BY created_at DESC LIMIT 1")
    .get(leadId) as { created_at: string } | undefined;
  if (lastOutbound && lastOutbound.created_at > lastInbound.created_at) {
    return { replied: false, reason: "já respondido" };
  }

  if (shouldEscalate(lastInbound.body)) {
    db.prepare("UPDATE leads SET ai_mode = 'copilot' WHERE id = ?").run(leadId);
    db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'ai.handoff', ?, ?)").run(
      leadId,
      "Cliente pediu atendimento humano — IA pausada neste lead",
      nowStamp(),
    );
    return { replied: false, reason: "handoff para humano" };
  }

  const draft = await draftReply(leadId);
  if (!draft.text) return { replied: false, reason: draft.error ?? "falha ao gerar" };

  const phone = (db.prepare("SELECT phone FROM leads WHERE id = ?").get(leadId) as { phone: string }).phone;
  const sent = await sendWhatsAppText(phone, draft.text);
  const stamp = nowStamp();

  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, author, created_at) VALUES (?, 'out', ?, ?, 'ia', ?, 'ai', ?)",
  ).run(leadId, draft.text, sent.ok ? "delivered" : "failed", sent.providerId ?? null, stamp);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(stamp, leadId);

  if (draft.handoff) {
    db.prepare("UPDATE leads SET ai_mode = 'copilot' WHERE id = ?").run(leadId);
  }

  db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'ai.reply', ?, ?)").run(
    leadId,
    `Resposta automática (${draft.model})${draft.simulated ? " · simulação" : ""}`,
    stamp,
  );

  return { replied: true };
}
