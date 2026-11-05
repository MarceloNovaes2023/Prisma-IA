"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { draftReply, setAiSetting } from "./ai";
import { confirmPayment, createCharge, type PaymentMethod } from "./payments";
import { getDb } from "./db";
import { nowStamp } from "./format";
import { getLead, getFollowups } from "./queries";
import { renderTemplate, scoreLead, verticalBySlug } from "./verticals";
import { intentBoost, normalizePhone, sendWhatsAppText } from "./whatsapp";

function refresh() {
  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/funil");
  revalidatePath("/leads");
  revalidatePath("/automacoes");
  revalidatePath("/operacoes");
  revalidatePath("/relatorios");
}

function addEvent(leadId: number | null, type: string, detail: string) {
  getDb()
    .prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, ?, ?, ?)")
    .run(leadId, type, detail, nowStamp());
}

const terminalStages = new Set([
  "fechado",
  "entregue",
  "vendido",
  "ativo",
  "onboarding",
  "recompra",
  "retorno",
  "perdido",
]);

export async function sendMessageAction(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId || !body) return;

  const lead = getLead(leadId);
  if (!lead) return;

  const result = await sendWhatsAppText(lead.phone, body);
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
  ).run(leadId, body, result.ok ? "delivered" : "failed", null, result.providerId ?? null, nowStamp());
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), leadId);
  addEvent(leadId, "message.out", result.ok ? "Mensagem enviada" : `Falha no envio: ${result.error}`);
  refresh();
}

export async function moveStageAction(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const stage = String(formData.get("stage") ?? "");
  if (!leadId || !stage) return;
  const lead = getLead(leadId);
  if (!lead) return;

  const vertical = verticalBySlug(lead.vertical);
  const stageCfg = vertical?.stages.find((s) => s.key === stage);
  if (!stageCfg) return;

  getDb().prepare("UPDATE leads SET stage = ? WHERE id = ?").run(stage, leadId);
  addEvent(leadId, "lead.stage", `Etapa alterada para ${stageCfg.label}`);

  // ao chegar em etapa terminal, encerra follow-ups pendentes
  if (terminalStages.has(stage)) {
    getDb().prepare("UPDATE followups SET status = 'skipped' WHERE lead_id = ? AND status = 'pending'").run(leadId);
  }
  refresh();
}

export async function createLeadAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
  const verticalSlug = String(formData.get("vertical") ?? "");
  const vertical = verticalBySlug(verticalSlug);
  if (!name || !phone || !vertical) return;

  const answers: Record<string, string> = {};
  for (const question of vertical.qualification) {
    const value = formData.get(`q_${question.key}`);
    if (value) answers[question.key] = String(value);
  }
  const score = scoreLead(verticalSlug, answers);
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM leads WHERE phone = ? OR phone = ?")
    .get(phone, `+${phone}`) as { id: number } | undefined;
  if (existing) {
    redirect(`/inbox?lead=${existing.id}`);
  }

  const createdAt = nowStamp();
  const result = db
    .prepare(
      `INSERT INTO leads (name, phone, email, vertical, stage, score, source, tags, value, owner, city, answers, notes, opted_in, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      name,
      phone,
      String(formData.get("email") ?? "") || null,
      verticalSlug,
      vertical.stages[0].key,
      score,
      String(formData.get("source") ?? "Manual"),
      score >= 75 ? "prioridade" : "nutrição",
      Number(formData.get("value") ?? 0) || 0,
      String(formData.get("owner") ?? "Ana Paula"),
      String(formData.get("city") ?? "") || null,
      JSON.stringify(answers),
      null,
      createdAt,
    );
  const leadId = Number(result.lastInsertRowid);

  // primeira mensagem da cadência, já personalizada
  const greeting = renderTemplate(vertical.greeting, {
    primeiro_nome: name.split(" ")[0],
    nome: name,
    vendedor: String(formData.get("owner") ?? "Ana Paula").split(" ")[0],
    empresa: "PRISMA IA",
    bairro: String(formData.get("bairro") ?? "seu bairro"),
    peca: String(formData.get("peca") ?? "nossa peça"),
    procedimento: String(formData.get("procedimento") ?? "o procedimento"),
    veiculo: String(formData.get("veiculo") ?? "o veículo"),
  });
  const send = await sendWhatsAppText(phone, greeting);
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
  ).run(leadId, greeting, send.ok ? "delivered" : "failed", "abertura", send.providerId ?? null, createdAt);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(createdAt, leadId);
  addEvent(leadId, "lead.created", `Lead criado manualmente (${vertical.short})`);

  const firstStep = vertical.cadence[1];
  if (firstStep) {
    const due = new Date(Date.now() + firstStep.day * 86400000).toISOString().slice(0, 19).replace("T", " ");
    db.prepare("INSERT INTO followups (lead_id, step, due_at, status, template) VALUES (?, ?, ?, 'pending', ?)").run(
      leadId,
      1,
      due,
      renderTemplate(firstStep.template, { primeiro_nome: name.split(" ")[0], nome: name, vendedor: "você", empresa: "PRISMA IA" }),
    );
  }
  refresh();
  redirect(`/inbox?lead=${leadId}`);
}

/** Captação pública: usada pelo formulário de cada nicho. */
export async function captureLeadAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
  const verticalSlug = String(formData.get("vertical") ?? "");
  const vertical = verticalBySlug(verticalSlug);
  if (!name || !phone || !vertical) return;

  const answers: Record<string, string> = {};
  for (const question of vertical.qualification) {
    const value = formData.get(`q_${question.key}`);
    if (value) answers[question.key] = String(value);
  }
  const score = scoreLead(verticalSlug, answers);
  const db = getDb();
  const createdAt = nowStamp();

  const existing = db
    .prepare("SELECT id FROM leads WHERE phone = ? OR phone = ?")
    .get(phone, `+${phone}`) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE leads SET score = MAX(score, ?), answers = ? WHERE id = ?").run(
      score,
      JSON.stringify(answers),
      existing.id,
    );
    addEvent(existing.id, "lead.returned", `Lead voltou pelo formulário de ${vertical.short}`);
    redirect(`/captar/${verticalSlug}?ok=1`);
  }

  const result = db
    .prepare(
      `INSERT INTO leads (name, phone, email, vertical, stage, score, source, tags, value, owner, city, answers, notes, opted_in, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      name,
      phone,
      String(formData.get("email") ?? "") || null,
      verticalSlug,
      vertical.stages[0].key,
      score,
      String(formData.get("source") ?? "Formulário do site"),
      score >= 75 ? "prioridade" : "novo",
      Number(formData.get("value") ?? 0) || 0,
      "Fila de entrada",
      String(formData.get("city") ?? "") || null,
      JSON.stringify(answers),
      null,
      createdAt,
    );
  const leadId = Number(result.lastInsertRowid);

  const greeting = renderTemplate(vertical.greeting, {
    primeiro_nome: name.split(" ")[0],
    nome: name,
    vendedor: "Time de atendimento",
    empresa: "nossa equipe",
    bairro: String(formData.get("city") ?? "seu bairro"),
    peca: String(formData.get("q_peca") ?? "a peça que você viu"),
    procedimento: answers[vertical.qualification[0].key] ?? "o procedimento",
    veiculo: String(formData.get("q_veiculo") ?? "o veículo"),
  });
  const send = await sendWhatsAppText(phone, greeting);
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, 'abertura', ?, ?)",
  ).run(leadId, greeting, send.ok ? "delivered" : "failed", send.providerId ?? null, createdAt);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(createdAt, leadId);
  addEvent(leadId, "lead.created", `Captado pelo formulário público de ${vertical.short}`);

  const firstStep = vertical.cadence[1];
  if (firstStep) {
    const due = new Date(Date.now() + firstStep.day * 86400000).toISOString().slice(0, 19).replace("T", " ");
    db.prepare("INSERT INTO followups (lead_id, step, due_at, status, template) VALUES (?, 1, ?, 'pending', ?)").run(
      leadId,
      due,
      renderTemplate(firstStep.template, {
        primeiro_nome: name.split(" ")[0],
        nome: name,
        vendedor: "Time de atendimento",
        empresa: "nossa equipe",
      }),
    );
  }

  refresh();
  redirect(`/captar/${verticalSlug}?ok=1`);
}

export async function skipFollowupAction(formData: FormData) {
  const id = Number(formData.get("followupId"));
  if (!id) return;
  getDb().prepare("UPDATE followups SET status = 'skipped' WHERE id = ?").run(id);
  refresh();
}

export async function sendFollowupAction(formData: FormData) {
  const id = Number(formData.get("followupId"));
  if (!id) return;
  const db = getDb();
  const followup = db.prepare("SELECT * FROM followups WHERE id = ?").get(id) as
    | { id: number; lead_id: number; template: string; step: number }
    | undefined;
  if (!followup) return;
  const lead = getLead(followup.lead_id);
  if (!lead) return;

  const result = await sendWhatsAppText(lead.phone, followup.template);
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
  ).run(
    lead.id,
    followup.template,
    result.ok ? "delivered" : "failed",
    `cadência ${followup.step + 1}`,
    result.providerId ?? null,
    nowStamp(),
  );
  db.prepare("UPDATE followups SET status = 'done', sent_at = ? WHERE id = ?").run(nowStamp(), id);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), lead.id);
  addEvent(lead.id, "followup.sent", `Follow-up ${followup.step + 1} enviado`);
  refresh();
}

/** Motor de cadência: dispara todos os follow-ups vencidos. */
export async function runCadenceAction() {
  const db = getDb();
  const due = db
    .prepare(
      `SELECT f.*, l.phone, l.name, l.vertical FROM followups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.due_at <= datetime('now') LIMIT 40`,
    )
    .all() as {
    id: number;
    lead_id: number;
    template: string;
    step: number;
    phone: string;
    name: string;
    vertical: string;
  }[];

  let sent = 0;
  for (const row of due) {
    const result = await sendWhatsAppText(row.phone, row.template);
    db.prepare(
      "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
    ).run(
      row.lead_id,
      row.template,
      result.ok ? "delivered" : "failed",
      `cadência ${row.step + 1}`,
      result.providerId ?? null,
      nowStamp(),
    );
    db.prepare("UPDATE followups SET status = 'done', sent_at = ? WHERE id = ?").run(nowStamp(), row.id);
    db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), row.lead_id);
    addEvent(row.lead_id, "followup.sent", `Cadência automática · etapa ${row.step + 1}`);
    sent += 1;
  }
  db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (NULL, 'cadence.run', ?, ?)").run(
    `Motor de cadência executado · ${sent} mensagens`,
    nowStamp(),
  );
  refresh();
  return { sent, considered: due.length };
}

/** Disparo em massa com trava de segurança (opt-in + limite por hora). */
export async function createBroadcastAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!name || !template) return;

  const db = getDb();
  const clauses = ["opted_in = 1"];
  const params: (string | number)[] = [];
  if (vertical) {
    clauses.push("vertical = ?");
    params.push(vertical);
  }
  if (stage) {
    clauses.push("stage = ?");
    params.push(stage);
  }
  const audience = db
    .prepare(`SELECT * FROM leads WHERE ${clauses.join(" AND ")} LIMIT 200`)
    .all(...params) as { id: number; name: string; phone: string; vertical: string }[];

  const info = db
    .prepare(
      "INSERT INTO broadcasts (name, vertical, stage_filter, template, total, sent, status, created_at) VALUES (?, ?, ?, ?, ?, 0, 'enviando', ?)",
    )
    .run(name, vertical || null, stage || null, template, audience.length, nowStamp());
  const broadcastId = Number(info.lastInsertRowid);

  let sent = 0;
  for (const lead of audience) {
    const verticalCfg = verticalBySlug(lead.vertical);
    const body = renderTemplate(template, {
      primeiro_nome: lead.name.split(" ")[0],
      nome: lead.name,
      empresa: "PRISMA IA",
      vendedor: "Time comercial",
      bairro: "Vila Mariana",
      peca: "nossa peça",
      procedimento: verticalCfg?.qualification[0].options[0].label ?? "o procedimento",
      veiculo: "o veículo",
    });
    const result = await sendWhatsAppText(lead.phone, body);
    db.prepare(
      "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
    ).run(lead.id, body, result.ok ? "delivered" : "failed", "disparo", result.providerId ?? null, nowStamp());
    db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), lead.id);
    if (result.ok) sent += 1;
  }
  db.prepare("UPDATE broadcasts SET sent = ?, status = 'concluido' WHERE id = ?").run(sent, broadcastId);
  addEvent(null, "broadcast.sent", `Disparo "${name}" · ${sent}/${audience.length}`);
  void broadcastId;
  refresh();
}

const orderFlow = ["aguardando", "producao", "enviado", "entregue"];

export async function advanceOrderAction(formData: FormData) {
  const orderId = Number(formData.get("orderId"));
  if (!orderId) return;
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as
    | { id: number; lead_id: number; status: string; total: number; cashback: number; code: string }
    | undefined;
  if (!order) return;

  const index = orderFlow.indexOf(order.status);
  const next = orderFlow[Math.min(orderFlow.length - 1, index + 1)];
  if (next === order.status) return;

  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(next, orderId);
  if (next === "entregue") {
    db.prepare("UPDATE orders SET delivered_at = ?, cashback_status = CASE WHEN cashback > 0 THEN 'credited' ELSE 'none' END WHERE id = ?").run(
      nowStamp(),
      orderId,
    );
    addEvent(order.lead_id, "order.delivered", `Pedido ${order.code} entregue · cashback liberado`);
  } else {
    addEvent(order.lead_id, "order.status", `Pedido ${order.code} → ${next}`);
  }
  refresh();
}

export async function redeemCashbackAction(formData: FormData) {
  const orderId = Number(formData.get("orderId"));
  if (!orderId) return;
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as
    | { id: number; lead_id: number; cashback: number; cashback_status: string; code: string }
    | undefined;
  if (!order) return;
  db.prepare("UPDATE orders SET cashback_status = 'redeemed' WHERE id = ?").run(orderId);
  addEvent(order.lead_id, "cashback.redeemed", `Cashback do pedido ${order.code} resgatado`);
  refresh();
}

export async function qualifyAction(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const lead = leadId ? getLead(leadId) : undefined;
  if (!lead) return;
  const vertical = verticalBySlug(lead.vertical);
  if (!vertical) return;

  const answers: Record<string, string> = JSON.parse(lead.answers || "{}");
  for (const question of vertical.qualification) {
    const value = formData.get(`q_${question.key}`);
    if (value) answers[question.key] = String(value);
  }
  const score = scoreLead(lead.vertical, answers);
  getDb()
    .prepare("UPDATE leads SET answers = ?, score = ? WHERE id = ?")
    .run(JSON.stringify(answers), score, lead.id);
  addEvent(lead.id, "lead.qualified", `Qualificação atualizada · score ${score}`);
  refresh();
}

/* ----------------------------- IA ----------------------------- */

export async function generateReplyAction(leadId: number) {
  const draft = await draftReply(leadId);
  refresh();
  return draft;
}

export async function setAiModeAction(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const mode = String(formData.get("aiMode") ?? "copilot");
  if (!leadId || !["auto", "copilot", "off"].includes(mode)) return;
  getDb().prepare("UPDATE leads SET ai_mode = ? WHERE id = ?").run(mode, leadId);
  addEvent(leadId, "ai.mode", `Modo da IA definido como ${mode}`);
  refresh();
}

export async function toggleAiAutoAction(formData: FormData) {
  const enabled = String(formData.get("enabled") ?? "off") === "on";
  setAiSetting("ai_auto", enabled ? "on" : "off");
  addEvent(null, "ai.settings", `Resposta automática ${enabled ? "ativada" : "desativada"} para toda a operação`);
  refresh();
}

/* ------------------------- PAGAMENTOS ------------------------- */

export async function createChargeAction(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "pix") as PaymentMethod;
  const description = String(formData.get("description") ?? "Pedido");
  if (!leadId || !amount || amount <= 0) return;

  const lead = getLead(leadId);
  if (!lead) return;

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3100";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";

  const result = await createCharge({
    leadId,
    amount,
    description,
    method,
    leadName: lead.name,
    payerEmail: lead.email ?? undefined,
    checkoutBaseUrl: `${protocol}://${host}`,
  });

  const link = result.payment.checkout_url ?? `${protocol}://${host}/pagar/${result.payment.code}`;
  const body =
    `Oi ${lead.name.split(" ")[0]}! Seu link de pagamento está pronto:\n` +
    `${link}\n` +
    `Valor: ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n` +
    `Assim que o pagamento cair, seu pedido é liberado automaticamente.`;

  const sent = await sendWhatsAppText(lead.phone, body);
  getDb()
    .prepare(
      "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, author, created_at) VALUES (?, 'out', ?, ?, 'pagamento', ?, 'system', ?)",
    )
    .run(leadId, body, sent.ok ? "delivered" : "failed", sent.providerId ?? null, nowStamp());
  getDb().prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), leadId);
  addEvent(leadId, "payment.created", `Cobrança ${result.payment.code} gerada (${result.provider})`);

  revalidatePath("/pagamentos");
  redirect(`/pagamentos?novo=${result.payment.code}`);
}

export async function confirmPaymentAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  if (!code) return;
  const result = await confirmPayment(code, "manual");
  addEvent(null, "payment.confirm", result.message);
  refresh();
  revalidatePath(`/pagar/${code}`);
  revalidatePath("/pagamentos");
}

export async function bumpScoreFromInbound(leadId: number, text: string) {
  const lead = getLead(leadId);
  if (!lead) return;
  const next = Math.max(0, Math.min(100, lead.score + intentBoost(text)));
  if (next === lead.score) return;
  getDb().prepare("UPDATE leads SET score = ? WHERE id = ?").run(next, leadId);
}

