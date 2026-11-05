import { nowStamp, dateTime } from "@/lib/format";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { radarDb } from "./db";

export type AlertChannel = "whatsapp" | "email";

export type PendingNotice = { id: number; kind: string; detail: string; created_at: string };

export type DeliveryResult = {
  ok: boolean;
  channel: AlertChannel;
  sent: number;
  destination: string;
  mode?: "cloud" | "sandbox" | "resend";
  message: string;
};

const KIND_LABEL: Record<string, string> = {
  source_down: "FORA DO AR",
  source_ok: "RECUPERADA",
  source_error_rate: "TAXA DE FALHA",
};

/** Tipos de alerta de fonte que saem por WhatsApp/e-mail. */
const SOURCE_ALERT_KINDS = "'source_down', 'source_ok', 'source_error_rate'";

/** Alertas de fonte que ainda não foram entregues com sucesso neste canal. */
export function pendingSourceAlerts(channel: AlertChannel, limit = 25): PendingNotice[] {
  return radarDb()
    .prepare(
      `SELECT al.id, al.kind, al.detail, al.created_at
       FROM radar_alerts al
       WHERE al.kind IN (${SOURCE_ALERT_KINDS})
         AND NOT EXISTS (
           SELECT 1 FROM radar_alert_sends s
           WHERE s.alert_id = al.id AND s.channel = ? AND s.status = 'sent'
         )
       ORDER BY al.id ASC
       LIMIT ?`,
    )
    .all(channel, limit) as PendingNotice[];
}

export function pendingCounts(): Record<AlertChannel, number> {
  return {
    whatsapp: pendingSourceAlerts("whatsapp", 500).length,
    email: pendingSourceAlerts("email", 500).length,
  };
}

/** Entrega automática ligada? `RADAR_ALERTS_AUTO=off` desliga e volta ao envio só pelo painel. */
export function autoAlertsEnabled(): boolean {
  const raw = process.env.RADAR_ALERTS_AUTO?.trim().toLowerCase();
  return raw !== "off" && raw !== "0" && raw !== "false";
}

/** Destinos padrão configurados no ambiente (o painel pode sobrescrever). */
export function alertDestinations(): { whatsapp: string; email: string } {
  return {
    whatsapp: process.env.RADAR_ALERT_WHATSAPP?.trim() ?? "",
    email: process.env.RADAR_ALERT_EMAIL?.trim() ?? "",
  };
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function lastDeliveries(limit = 6) {
  return radarDb()
    .prepare(
      `SELECT channel, destination, status, provider_id, error, created_at
       FROM radar_alert_sends ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as {
    channel: string;
    destination: string;
    status: string;
    provider_id: string | null;
    error: string | null;
    created_at: string;
  }[];
}

export type SourceDelivery = {
  id: number;
  alert_id: number;
  kind: string;
  source: string | null;
  detail: string;
  channel: string;
  destination: string;
  status: string;
  error: string | null;
  created_at: string;
};

/**
 * Histórico dos avisos de fonte já entregues: canal, destino, horário do envio
 * e a fonte que originou cada um. `source` restringe a uma fonte específica.
 */
export function sourceDeliveries(options: { source?: string; limit?: number } = {}): SourceDelivery[] {
  const limit = options.limit ?? 40;
  const bySource = options.source ? "AND al.source = ?" : "";
  const params = options.source ? [options.source, limit] : [limit];
  return radarDb()
    .prepare(
      `SELECT s.id, s.alert_id, al.kind, al.source, al.detail, s.channel, s.destination, s.status, s.error, s.created_at
       FROM radar_alert_sends s
       JOIN radar_alerts al ON al.id = s.alert_id
       WHERE al.kind IN (${SOURCE_ALERT_KINDS}) ${bySource}
       ORDER BY s.id DESC
       LIMIT ?`,
    )
    .all(...params) as SourceDelivery[];
}

/** Fontes que já tiveram aviso entregue, com a data do último envio. */
export function deliveredSources(): { source: string | null; deliveries: number; last_at: string }[] {
  return radarDb()
    .prepare(
      `SELECT al.source AS source, COUNT(*) AS deliveries, MAX(s.created_at) AS last_at
       FROM radar_alert_sends s
       JOIN radar_alerts al ON al.id = s.alert_id
       WHERE al.kind IN (${SOURCE_ALERT_KINDS})
       GROUP BY al.source
       ORDER BY last_at DESC`,
    )
    .all() as { source: string | null; deliveries: number; last_at: string }[];
}

function buildDigest(notices: PendingNotice[]): string {
  const lines = ["*PRISMA IA Radar* · status das fontes", ""];
  for (const notice of notices) {
    const label = KIND_LABEL[notice.kind] ?? notice.kind;
    lines.push(`[${label}] ${notice.detail} (${dateTime(notice.created_at)})`);
  }
  lines.push("", `${notices.length} alerta(s) · envie do painel Radar › Alertas.`);
  return lines.join("\n");
}

function buildEmail(notices: PendingNotice[], subject: string) {
  const rows = notices
    .map((notice) => {
      const label = KIND_LABEL[notice.kind] ?? notice.kind;
      const color = notice.kind === "source_down" ? "#f2607a" : notice.kind === "source_ok" ? "#a3f04b" : "#f5b841";
      return `<tr>
        <td style="padding:8px 0;vertical-align:top"><span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;background:${color}22;color:${color}">${label}</span></td>
        <td style="padding:8px 0 8px 12px;font-size:13px;color:#c9d4de">${escapeHtml(notice.detail)}<br><span style="font-size:11px;color:#5f6f7e">${dateTime(notice.created_at)}</span></td>
      </tr>`;
    })
    .join("");

  return {
    subject,
    html: `<div style="background:#070a0e;padding:24px;font-family:Inter,Segoe UI,sans-serif;color:#e8eef4">
      <h1 style="font-size:15px;margin:0 0 4px">PRISMA IA Radar · status das fontes</h1>
      <p style="font-size:12px;color:#8b9aa8;margin:0 0 16px">${notices.length} alerta(s) pendente(s)</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`,
    text: buildDigest(notices),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type SendOutcome = { ok: boolean; mode: DeliveryResult["mode"]; providerId?: string; error?: string };

/** Envia por e-mail via API REST da Resend (sem SDK). */
async function sendEmail(to: string, notices: PendingNotice[]): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, mode: "resend", error: "RESEND_API_KEY não configurada" };

  const from = process.env.RADAR_ALERT_FROM?.trim() || "PRISMA IA Radar <onboarding@resend.dev>";
  const subject = `Radar · ${notices.length} alerta(s) de fonte — ${dateTime(nowStamp())}`;
  const body = buildEmail(notices, subject);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html: body.html, text: body.text }),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return { ok: false, mode: "resend", error: payload.message ?? `Resend respondeu ${response.status}` };
    }
    return { ok: true, mode: "resend", providerId: payload.id };
  } catch (error) {
    return { ok: false, mode: "resend", error: error instanceof Error ? error.message : "falha ao enviar e-mail" };
  }
}

function recordSend(
  noticeId: number,
  channel: AlertChannel,
  destination: string,
  outcome: SendOutcome,
): void {
  radarDb()
    .prepare(
      `INSERT INTO radar_alert_sends (alert_id, channel, destination, status, provider_id, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      noticeId,
      channel,
      destination,
      outcome.ok ? "sent" : "failed",
      outcome.providerId ?? null,
      outcome.error ?? null,
      nowStamp(),
    );
}

/** Evita martelar o provedor: se a última tentativa deste canal falhou há pouco, espera. */
function recentlyFailed(channel: AlertChannel, destination: string): boolean {
  const row = radarDb()
    .prepare("SELECT status, created_at FROM radar_alert_sends WHERE channel = ? AND destination = ? ORDER BY id DESC LIMIT 1")
    .get(channel, destination) as { status: string; created_at: string } | undefined;
  if (!row || row.status === "sent") return false;
  const attemptedAt = Date.parse(`${row.created_at.replace(" ", "T")}Z`);
  return Number.isFinite(attemptedAt) && Date.now() - attemptedAt < 15 * 60 * 1000;
}

/**
 * Chamada depois de cada sincronização: entrega o que estiver pendente nos canais
 * configurados no ambiente, sem ninguém clicar em nada.
 */
export async function dispatchSourceAlerts(): Promise<DeliveryResult[]> {
  if (!autoAlertsEnabled()) return [];

  const targets = alertDestinations();
  const jobs: { channel: AlertChannel; to: string }[] = [];
  if (targets.whatsapp) jobs.push({ channel: "whatsapp", to: targets.whatsapp });
  if (targets.email && emailConfigured()) jobs.push({ channel: "email", to: targets.email });

  const results: DeliveryResult[] = [];
  for (const job of jobs) {
    if (recentlyFailed(job.channel, job.to)) {
      results.push({
        ok: false,
        channel: job.channel,
        sent: 0,
        destination: job.to,
        message: "Última tentativa falhou há menos de 15 min — aguardando para não repetir o erro.",
      });
      continue;
    }
    results.push(await deliverSourceAlerts(job));
  }
  return results;
}

/**
 * Entrega os alertas de "fonte fora do ar" e "fonte recuperada" que ainda não
 * saíram por este canal. Cada alerta entregue fica registrado, então um novo
 * envio não repete o que já foi avisado.
 */
export async function deliverSourceAlerts(input: {
  channel: AlertChannel;
  to: string;
  limit?: number;
}): Promise<DeliveryResult> {
  const destination = input.to.trim();
  if (input.channel !== "whatsapp" && input.channel !== "email") {
    return { ok: false, channel: "whatsapp", sent: 0, destination, message: "Canal inválido" };
  }
  if (!destination) {
    return { ok: false, channel: input.channel, sent: 0, destination, message: "Informe o destino do envio" };
  }

  const notices = pendingSourceAlerts(input.channel, input.limit ?? 25);
  if (notices.length === 0) {
    return {
      ok: true,
      channel: input.channel,
      sent: 0,
      destination,
      message: "Nenhum alerta de fonte pendente para este canal.",
    };
  }

  const outcome: SendOutcome =
    input.channel === "whatsapp"
      ? await (async () => {
          const result = await sendWhatsAppText(destination, buildDigest(notices));
          return { ok: result.ok, mode: result.mode, providerId: result.providerId, error: result.error };
        })()
      : await sendEmail(destination, notices);

  if (!outcome.ok) {
    recordSend(notices[0].id, input.channel, destination, outcome);
    return {
      ok: false,
      channel: input.channel,
      sent: 0,
      destination,
      mode: outcome.mode,
      message: outcome.error ?? "Falha no envio",
    };
  }

  for (const notice of notices) {
    recordSend(notice.id, input.channel, destination, outcome);
  }

  const via = input.channel === "email" ? "e-mail" : outcome.mode === "sandbox" ? "WhatsApp (sandbox)" : "WhatsApp";
  return {
    ok: true,
    channel: input.channel,
    sent: notices.length,
    destination,
    mode: outcome.mode,
    message: `${notices.length} alerta(s) enviado(s) por ${via} para ${destination}.`,
  };
}
