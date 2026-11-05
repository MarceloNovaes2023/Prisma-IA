/** Adaptador da WhatsApp Cloud API (Meta) com modo sandbox local. */

export const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export type ProviderInfo = {
  mode: "cloud" | "sandbox";
  displayNumber: string;
  phoneNumberId?: string;
  token?: string;
  appId?: string;
  verifyToken?: string;
};

export function getProvider(): ProviderInfo {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const displayNumber = process.env.WHATSAPP_DISPLAY_NUMBER?.trim() || "+55 11 4002-8922";
  if (token && phoneNumberId) {
    return {
      mode: "cloud",
      displayNumber,
      phoneNumberId,
      token,
      appId: process.env.WHATSAPP_APP_ID,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    };
  }
  return { mode: "sandbox", displayNumber, verifyToken: process.env.WHATSAPP_VERIFY_TOKEN };
}

/** Normaliza para o formato E.164 sem "+" que a Cloud API exige (ex.: 5511987654321). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export type SendResult = {
  ok: boolean;
  mode: "cloud" | "sandbox";
  providerId?: string;
  error?: string;
};

export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const provider = getProvider();

  if (provider.mode === "sandbox") {
    // Nenhuma mensagem sai da máquina: o envio é registrado e marcado como entregue.
    return { ok: true, mode: "sandbox", providerId: `sandbox_${Date.now().toString(36)}` };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${provider.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizePhone(to),
          type: "text",
          text: { preview_url: false, body },
        }),
      },
    );
    const data = (await response.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!response.ok) {
      return {
        ok: false,
        mode: "cloud",
        error: data?.error?.message ?? `Cloud API respondeu ${response.status}`,
      };
    }
    return { ok: true, mode: "cloud", providerId: data?.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, mode: "cloud", error: (error as Error).message };
  }
}

export type InboundMessage = {
  from: string;
  name?: string;
  text: string;
  providerId?: string;
  timestamp?: string;
};

type CloudWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }[];
      };
    }[];
  }[];
};

export function parseInboundWebhook(payload: CloudWebhookPayload): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name;
      for (const message of value?.messages ?? []) {
        const text =
          message.text?.body ??
          message.button?.text ??
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "";
        if (!message.from || !text) continue;
        out.push({
          from: message.from,
          name: contactName,
          text,
          providerId: message.id,
          timestamp: message.timestamp,
        });
      }
    }
  }
  return out;
}

/** Detecta intenção de compra/urgência em texto livre — usado para reaquecer o score. */
export function intentBoost(text: string): number {
  const normalized = text.toLowerCase();
  const hot = [
    "quanto custa",
    "quanto fica",
    "valor",
    "preço",
    "preco",
    "fechar",
    "fechado",
    "hoje",
    "amanhã",
    "amanha",
    "urgente",
    "agendar",
    "pix",
    "link de pagamento",
    "disponível",
    "disponivel",
    "quero",
  ];
  const cold = ["depois", "semana que vem", "só olhando", "so olhando", "pesquisando", "caro demais"];
  let delta = 0;
  for (const word of hot) if (normalized.includes(word)) delta += 4;
  for (const word of cold) if (normalized.includes(word)) delta -= 6;
  return Math.max(-10, Math.min(12, delta));
}
