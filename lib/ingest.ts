import { getDb } from "./db";
import { nowStamp } from "./format";
import { renderTemplate, scoreLead, verticalBySlug } from "./verticals";
import { intentBoost, normalizePhone, sendWhatsAppText } from "./whatsapp";

export type IngestInput = {
  name: string;
  phone: string;
  vertical: string;
  source?: string;
  city?: string;
  value?: number;
  email?: string;
  answers?: Record<string, string>;
};

export type IngestResult = {
  id: number;
  score: number;
  created: boolean;
  firstMessage?: string;
};

export function defaultVertical(): string {
  const configured = process.env.WHATSAPP_DEFAULT_VERTICAL;
  return configured && verticalBySlug(configured) ? configured : "moda-varejo";
}

/** Cria (ou reaproveita) um lead vindo de formulário/webhook/API. */
export function ingestLead(input: IngestInput): IngestResult {
  const vertical = verticalBySlug(input.vertical) ?? verticalBySlug(defaultVertical())!;
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const answers = input.answers ?? {};
  const score = scoreLead(vertical.slug, answers);

  const existing = db
    .prepare("SELECT id, score FROM leads WHERE phone = ? OR phone = ?")
    .get(phone, `+${phone}`) as { id: number; score: number } | undefined;

  if (existing) {
    db.prepare("UPDATE leads SET answers = ?, score = MAX(score, ?), last_inbound_at = ? WHERE id = ?").run(
      JSON.stringify(answers),
      score,
      nowStamp(),
      existing.id,
    );
    db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'lead.returned', ?, ?)").run(
      existing.id,
      `Lead retornou por ${input.source ?? "captação"}`,
      nowStamp(),
    );
    return { id: existing.id, score: Math.max(existing.score, score), created: false };
  }

  const createdAt = nowStamp();
  const result = db
    .prepare(
      `INSERT INTO leads (name, phone, email, vertical, stage, score, source, tags, value, owner, city, answers, notes, opted_in, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      input.name,
      phone,
      input.email ?? null,
      vertical.slug,
      vertical.stages[0].key,
      score,
      input.source ?? "API",
      score >= 75 ? "prioridade" : "novo",
      input.value ?? 0,
      "Fila de entrada",
      input.city ?? null,
      JSON.stringify(answers),
      null,
      createdAt,
    );
  const id = Number(result.lastInsertRowid);

  db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'lead.created', ?, ?)").run(
    id,
    `Lead criado via ${input.source ?? "API"} (${vertical.short})`,
    createdAt,
  );

  const greeting = renderTemplate(vertical.greeting, {
    primeiro_nome: input.name.split(" ")[0],
    nome: input.name,
    vendedor: "Time de atendimento",
    empresa: "nossa equipe",
    bairro: input.city ?? "seu bairro",
    peca: answers.peca ?? "a peça que você viu",
    procedimento: answers[vertical.qualification[0].key] ?? "o procedimento",
    veiculo: answers.veiculo ?? "o veículo",
  });

  return { id, score, created: true, firstMessage: greeting };
}

/** Dispara a abertura e agenda o primeiro follow-up. */
export async function startCadence(leadId: number, phone: string, verticalSlug: string, name: string) {
  const db = getDb();
  const vertical = verticalBySlug(verticalSlug);
  if (!vertical) return;

  const greeting = renderTemplate(vertical.greeting, {
    primeiro_nome: name.split(" ")[0],
    nome: name,
    vendedor: "Time de atendimento",
    empresa: "nossa equipe",
  });
  const send = await sendWhatsAppText(phone, greeting);
  const stamp = nowStamp();
  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, 'abertura', ?, ?)",
  ).run(leadId, greeting, send.ok ? "delivered" : "failed", send.providerId ?? null, stamp);
  db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(stamp, leadId);

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
}

/** Processa mensagem recebida: encontra/cria lead, grava e ajusta score. */
export async function handleInbound(input: {
  from: string;
  name?: string;
  text: string;
  providerId?: string;
  vertical?: string;
}): Promise<{ leadId: number; created: boolean }> {
  const db = getDb();
  const phone = normalizePhone(input.from);
  const existing = db
    .prepare("SELECT id, score, vertical, name FROM leads WHERE phone = ? OR phone = ?")
    .get(phone, `+${phone}`) as { id: number; score: number; vertical: string; name: string } | undefined;

  const stamp = nowStamp();

  if (existing) {
    db.prepare(
      "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'in', ?, 'received', NULL, ?, ?)",
    ).run(existing.id, input.text, input.providerId ?? null, stamp);
    const nextScore = Math.max(0, Math.min(100, existing.score + intentBoost(input.text)));
    db.prepare("UPDATE leads SET last_inbound_at = ?, score = ? WHERE id = ?").run(stamp, nextScore, existing.id);
    db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'message.in', ?, ?)").run(
      existing.id,
      `Mensagem recebida${input.text.length > 40 ? "" : `: ${input.text}`}`,
      stamp,
    );
    return { leadId: existing.id, created: false };
  }

  const vertical = verticalBySlug(input.vertical ?? defaultVertical())!;
  const initialScore = Math.max(10, Math.min(80, 40 + intentBoost(input.text)));
  const result = db
    .prepare(
      `INSERT INTO leads (name, phone, vertical, stage, score, source, tags, value, owner, answers, opted_in, created_at, last_inbound_at)
       VALUES (?, ?, ?, ?, ?, 'WhatsApp', 'novo', 0, 'Fila de entrada', '{}', 1, ?, ?)`,
    )
    .run(input.name ?? "Contato WhatsApp", phone, vertical.slug, vertical.stages[0].key, initialScore, stamp, stamp);
  const leadId = Number(result.lastInsertRowid);

  db.prepare(
    "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'in', ?, 'received', NULL, ?, ?)",
  ).run(leadId, input.text, input.providerId ?? null, stamp);
  db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (?, 'lead.created', ?, ?)").run(
    leadId,
    "Novo lead chegou pelo WhatsApp",
    stamp,
  );

  return { leadId, created: true };
}
