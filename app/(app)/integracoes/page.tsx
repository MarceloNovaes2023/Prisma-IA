import { headers } from "next/headers";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, CreditCard, Instagram, Link2, Plug, ShieldCheck, Webhook } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, PageHeader, SectionHeader } from "@/components/ui";
import { toggleAiAutoAction } from "@/lib/actions";
import { getAiConfig, getAiSettings } from "@/lib/ai";
import { getPaymentProvider } from "@/lib/payments";
import { getProvider } from "@/lib/whatsapp";
import { VERTICALS } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const provider = getProvider();
  const ai = getAiConfig();
  const aiSettings = getAiSettings();
  const payments = getPaymentProvider();
  const head = await headers();
  const host = head.get("host") ?? "localhost:3100";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const envVars = [
    { key: "WHATSAPP_TOKEN", desc: "Token permanente do app (System User) no Meta Business" },
    { key: "WHATSAPP_PHONE_NUMBER_ID", desc: "ID do número no WhatsApp Manager" },
    { key: "WHATSAPP_VERIFY_TOKEN", desc: "String secreta que você define para validar o webhook" },
    { key: "WHATSAPP_APP_ID", desc: "App ID da Meta (opcional, para logs)" },
    { key: "WHATSAPP_DISPLAY_NUMBER", desc: "Número exibido na interface (opcional)" },
    { key: "CRON_SECRET", desc: "Protege o endpoint que roda as cadências" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Configuração"
        title="Integrações"
        description="WhatsApp oficial, webhooks de captação e links por nicho. Sem credencial, a plataforma roda em sandbox e não envia nada de verdade."
        actions={
          <Badge tone={provider.mode === "cloud" ? "lime" : "amber"} dot>
            {provider.mode === "cloud" ? "Cloud API ativa" : "Modo sandbox"}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <SectionHeader title="WhatsApp Cloud API" hint="Número oficial da Meta (WABA)" />
          <div className="rounded-lg border border-line bg-[#0b1219] p-3">
            <div className="flex items-center gap-2">
              {provider.mode === "cloud" ? (
                <CheckCircle2 size={14} className="text-lime" />
              ) : (
                <AlertTriangle size={14} className="text-amber" />
              )}
              <p className="text-[12px] font-medium">
                {provider.mode === "cloud" ? "Conectado ao número oficial" : "Nenhuma credencial configurada"}
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              {provider.mode === "cloud"
                ? `Enviando por ${provider.displayNumber}. Mensagens fora da janela de 24h exigem template aprovado.`
                : `Em sandbox, os envios são registrados como entregues no banco e exibidos como ${provider.displayNumber}. Nada sai da máquina.`}
            </p>
          </div>

          <div className="space-y-2">
            {envVars.map((item) => (
              <div key={item.key} className="flex items-start gap-2 border-b border-line-soft pb-2 last:border-0 last:pb-0">
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-lime/90">{item.key}</code>
                <span className="text-[10.5px] leading-relaxed text-dim">{item.desc}</span>
              </div>
            ))}
          </div>

          <ol className="space-y-1 text-[10.5px] leading-relaxed text-dim">
            <li>1. Crie um app Business em developers.facebook.com e adicione o produto WhatsApp.</li>
            <li>2. Registre um número, gere o token permanente em Configurações do sistema.</li>
            <li>3. Cole as variáveis no arquivo .env.local e reinicie o servidor.</li>
            <li>4. Aponte o webhook para a URL abaixo e verifique com o token definido.</li>
          </ol>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <SectionHeader title="Webhook de recebimento" hint="Mensagens recebidas viram conversa na Inbox" />
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
                {baseUrl}/api/webhooks/whatsapp
              </code>
              <CopyButton value={`${baseUrl}/api/webhooks/whatsapp`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-dim">Verify token</span>
              <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
                valor de WHATSAPP_VERIFY_TOKEN
              </code>
            </div>
            <p className="text-[10.5px] leading-relaxed text-dim">
              A rota valida o handshake GET (hub.challenge) e processa POST no formato da Cloud API: cria o lead se
              não existir, registra a mensagem, ajusta o score pela intenção detectada e responde no primeiro
              contato.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="violet">
                <Webhook size={10} /> POST events
              </Badge>
              <Badge tone="neutral">GET verify</Badge>
              <Badge tone="lime">score automático</Badge>
            </div>
          </Card>

          <Card className="space-y-2.5">
            <SectionHeader title="API de captação" hint="Cole no seu site, landing page ou automação" />
            <pre className="overflow-x-auto rounded-lg border border-line bg-[#0b1219] p-2.5 text-[10px] leading-relaxed text-muted">
{`curl -X POST ${baseUrl}/api/leads \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Bruna Almeida",
    "phone": "+5511987654321",
    "vertical": "moda-atacado",
    "source": "Instagram",
    "city": "São Paulo",
    "value": 2400,
    "answers": { "volume": "Acima de 100 peças" }
  }'`}
            </pre>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
                {baseUrl}/api/leads
              </code>
              <CopyButton value={`${baseUrl}/api/leads`} />
            </div>
            <p className="text-[10.5px] leading-relaxed text-dim">
              Retorna id, score e link da conversa. A primeira mensagem da cadência sai automaticamente.
            </p>
          </Card>
        </div>
      </div>

      <Card className="space-y-3">
        <SectionHeader
          title="Links de captação por nicho"
          hint="Uma URL pronta por operação — use no Instagram, Google ou QR code da loja"
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {VERTICALS.map((vertical) => {
            const url = `${baseUrl}/captar/${vertical.slug}`;
            return (
              <div key={vertical.slug} className="flex items-center gap-2 rounded-lg border border-line bg-[#0b1219] p-2">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: vertical.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium">{vertical.short}</p>
                  <p className="truncate text-[10px] text-dim">{url.replace(baseUrl, "")}</p>
                </div>
                <CopyButton value={url} label="" />
                <Link
                  href={`/captar/${vertical.slug}`}
                  className="text-[10px] font-medium text-lime hover:underline"
                  target="_blank"
                >
                  Abrir
                </Link>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2.5">
          <SectionHeader title="Instagram e Facebook" hint="Duas formas de ligar as redes ao funil" />
          <div className="space-y-2 text-[11px] leading-relaxed text-dim">
            <p className="flex items-start gap-2">
              <Instagram size={13} className="mt-0.5 shrink-0 text-violet" />
              <span>
                <span className="text-fg">Link na bio / anúncio:</span> use as URLs de captação por nicho. O lead
                preenche e cai direto na cadência, com a origem já marcada.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Link2 size={13} className="mt-0.5 shrink-0 text-lime" />
              <span>
                <span className="text-fg">Click-to-WhatsApp:</span>{" "}
                <code className="text-[10px] text-muted">
                  https://wa.me/{provider.displayNumber.replace(/\D/g, "")}?text=Quero%20saber%20mais
                </code>{" "}
                — a conversa cai no mesmo número, e o webhook identifica de qual anúncio veio.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Webhook size={13} className="mt-0.5 shrink-0 text-cyan" />
              <span>
                <span className="text-fg">Lead Ads:</span> aponte o webhook do formulário para{" "}
                <code className="text-[10px] text-muted">/api/leads</code> com{" "}
                <code className="text-[10px] text-muted">source: &quot;Meta Lead Ads&quot;</code>.
              </span>
            </p>
          </div>
        </Card>

        <Card className="space-y-2.5">
          <SectionHeader title="Automação de follow-up" hint="Rode o motor por cron" />
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-[#0b1219] px-2 py-1.5 text-[11px] text-muted">
              {baseUrl}/api/cron/cadences
            </code>
            <CopyButton value={`${baseUrl}/api/cron/cadences`} />
          </div>
          <p className="text-[10.5px] leading-relaxed text-dim">
            Endpoint protegido por <code className="text-muted">Authorization: Bearer $CRON_SECRET</code>. Agende
            a cada 15 minutos no cron do servidor, no GitHub Actions ou no agendador da sua hospedagem.
          </p>
          <div className="rounded-lg border border-line bg-[#0b1219] p-2.5 text-[10.5px] leading-relaxed text-dim">
            <p className="flex items-center gap-1.5 text-fg">
              <ShieldCheck size={12} className="text-lime" /> Guardrails aplicados
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Apenas leads com opt-in entram em disparo</li>
              <li>Máximo de 200 contatos por campanha</li>
              <li>1 mensagem por lead a cada 24h</li>
              <li>Etapa terminal encerra a cadência</li>
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <SectionHeader
            title="IA de atendimento"
            hint="Vendedor consultivo com guardrails de respeito"
            action={
              <Badge tone={ai.configured ? "lime" : "amber"} dot>
                {ai.configured ? ai.model : "simulador local"}
              </Badge>
            }
          />
          <div className="rounded-lg border border-line bg-[#0b1219] p-3">
            <div className="flex items-center gap-2">
              <Bot size={14} className={ai.configured ? "text-lime" : "text-amber"} />
              <p className="text-[12px] font-medium">
                {ai.configured ? `${ai.provider} conectada` : "Nenhuma chave configurada"}
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              {ai.configured
                ? `Modelo ${ai.model} via ${new URL(ai.baseUrl).host}. Sugestões revisadas antes de enviar no modo copiloto.`
                : "Sem chave, a IA roda em simulação determinística: mesmo tom e mesma técnica, sem custo e sem chamada externa."}
            </p>
          </div>

          <form action={toggleAiAutoAction} className="flex items-center justify-between rounded-lg border border-line bg-[#0b1219] px-3 py-2">
            <div>
              <p className="text-[11.5px] font-medium">Resposta automática</p>
              <p className="text-[10px] text-dim">
                {aiSettings.auto
                  ? "IA responde sozinha os leads em modo automático"
                  : "IA só sugere; um humano envia"}
              </p>
            </div>
            <input type="hidden" name="enabled" value={aiSettings.auto ? "off" : "on"} />
            <button className={aiSettings.auto ? "btn" : "btn btn-primary"} type="submit">
              {aiSettings.auto ? "Desligar" : "Ativar"}
            </button>
          </form>

          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-dim">
            <p>
              <code className="text-lime/90">AI_API_KEY</code> · <code className="text-lime/90">AI_API_BASE</code> ·{" "}
              <code className="text-lime/90">AI_MODEL</code> — qualquer endpoint compatível com OpenAI serve (Z.ai,
              Freebuff, OpenAI, Groq).
            </p>
            <p className="text-amber/80">
              Para produção, valide o tom com o time antes de ativar o modo automático.
            </p>
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionHeader
            title="Pagamentos"
            hint="PIX/cartão com liberação automática do pedido"
            action={
              <Badge tone={payments.mode === "mercadopago" ? "lime" : "amber"} dot>
                {payments.name}
              </Badge>
            }
          />
          <div className="rounded-lg border border-line bg-[#0b1219] p-3">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-lime" />
              <p className="text-[12px] font-medium">
                {payments.mode === "mercadopago" ? "Mercado Pago conectado" : "Modo sandbox"}
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              {payments.mode === "mercadopago"
                ? "Cobranças reais com PIX e confirmação por webhook."
                : "O BR Code é gerado localmente e o pagamento é simulado no checkout público."}
            </p>
          </div>
          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-dim">
            <p>
              <code className="text-lime/90">MERCADOPAGO_ACCESS_TOKEN</code> — token de produção do Mercado Pago.
            </p>
            <p>
              <code className="text-lime/90">PIX_KEY</code> · <code className="text-lime/90">PIX_MERCHANT_NAME</code>{" "}
              · <code className="text-lime/90">PIX_MERCHANT_CITY</code> — usados no BR Code do sandbox.
            </p>
            <p>
              Webhook: <code className="text-muted">{baseUrl}/api/webhooks/payments</code>
            </p>
          </div>
          <Link href="/pagamentos" className="btn w-full">
            Abrir pagamentos
          </Link>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Plug size={16} className="text-lime" />
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-dim">
          Provedores alternativos (Twilio, 360dialog, Gupshup) entram trocando apenas o adaptador{" "}
          <code className="text-muted">lib/whatsapp.ts</code> — o resto da plataforma não muda.
        </p>
        <Link href="/nichos" className="btn">
          Ver playbooks
        </Link>
      </Card>
    </div>
  );
}
