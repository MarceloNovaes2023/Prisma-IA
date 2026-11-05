import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Clock3, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { VERTICAL_ICONS } from "@/components/sidebar";
import { captureLeadAction } from "@/lib/actions";
import { VERTICALS, verticalBySlug } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return VERTICALS.map((vertical) => ({ slug: vertical.slug }));
}

export default async function CaptarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; src?: string }>;
}) {
  const { slug } = await params;
  const { ok, src } = await searchParams;
  const vertical = verticalBySlug(slug);
  if (!vertical) notFound();

  const Icon = VERTICAL_ICONS[vertical.icon];
  const highlights = vertical.playbook.kpis;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40"
        style={{
          background: `radial-gradient(ellipse at 50% -10%, ${vertical.color}55, transparent 65%)`,
        }}
      />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-lime text-lime-ink">
            <Zap size={13} strokeWidth={2.8} />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">PRISMA IA</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-dim">
          <ShieldCheck size={12} /> seus dados protegidos (LGPD)
        </span>
      </header>

      <main className="relative mx-auto grid max-w-5xl gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={{ borderColor: `${vertical.color}44`, color: vertical.color, background: `${vertical.color}12` }}
          >
            {Icon ? <Icon size={11} /> : <Sparkles size={11} />}
            {vertical.short}
          </span>

          <h1 className="mt-4 max-w-[18ch] text-balance text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
            {vertical.playbook.offer}
          </h1>
          <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
            Preencha em 40 segundos. Um especialista responde no WhatsApp em poucos minutos com o próximo passo
            pronto — sem robô empurrando tabela de preço.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {highlights.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-line bg-[#0d1319] p-3">
                <p className="text-[20px] font-semibold leading-none">{kpi.value}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-dim">{kpi.label}</p>
              </div>
            ))}
          </div>

          <ul className="mt-6 space-y-2">
            {[
              `Atendimento por ${vertical.playbook.cycle} em média — sem fila de espera`,
              "Você fala com uma pessoa, não com um robô de menu",
              "Primeira condição exclusiva enviada no WhatsApp",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12px] text-muted">
                <Check size={13} className="mt-0.5 shrink-0" style={{ color: vertical.color }} />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-line bg-[#0d1319] p-3.5">
            <p className="text-[10.5px] uppercase tracking-wider text-dim">Dúvida mais comum</p>
            <p className="mt-1 text-[12px] font-medium">“{vertical.playbook.objections[0].q}”</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{vertical.playbook.objections[0].a}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-[#0d1319] p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          {ok === "1" ? (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-lime/15 text-lime">
                <Check size={20} />
              </span>
              <h2 className="mt-3 text-[17px] font-semibold">Recebemos seu contato</h2>
              <p className="mx-auto mt-1.5 max-w-[30ch] text-[12px] leading-relaxed text-muted">
                Sua mensagem já está aberta no WhatsApp da equipe. O primeiro retorno chega em poucos minutos em
                horário comercial.
              </p>
              <div className="mt-4 rounded-lg border border-line bg-[#0b1015] p-3 text-left">
                <p className="text-[10.5px] uppercase tracking-wider text-dim">Enquanto isso</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                  Se você não recebeu o WhatsApp, confira se o número informado tem conta ativa e libere mensagens
                  de desconhecidos.
                </p>
              </div>
              <Link href={`/captar/${slug}`} className="btn mt-4 w-full">
                Enviar outro contato
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MessageCircle size={15} style={{ color: vertical.color }} />
                <p className="text-[13px] font-semibold">Fale com a equipe</p>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-dim">
                  <Clock3 size={10} /> resposta em minutos
                </span>
              </div>

              <form action={captureLeadAction} className="mt-4 space-y-3">
                <input type="hidden" name="vertical" value={vertical.slug} />
                <input type="hidden" name="source" value={src || "Formulário do site"} />

                <div>
                  <label className="label">Seu nome</label>
                  <input name="name" required className="input" placeholder="Como podemos te chamar?" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input name="phone" required className="input" placeholder="(11) 98765-4321" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {vertical.qualification.slice(0, 3).map((question) => (
                    <div key={question.key}>
                      <label className="label">{question.label}</label>
                      <select name={`q_${question.key}`} className="select" defaultValue="">
                        <option value="">Selecione</option>
                        {question.options.map((option) => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="label">Cidade / bairro</label>
                  <input name="city" className="input" placeholder="Onde você está?" />
                </div>

                <button type="submit" className="btn btn-primary h-10 w-full">
                  Quero ser atendido
                </button>
                <p className="text-center text-[9.5px] leading-relaxed text-dim">
                  Ao enviar, você autoriza o contato por WhatsApp. Sem spam, cancelamento a qualquer momento.
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="relative mx-auto max-w-5xl border-t border-line px-6 py-4 text-[10px] text-dim">
        PRISMA IA · automação de vendas no WhatsApp ·{" "}
        <Link href="/" className="text-muted hover:text-lime">
          painel da operação
        </Link>
      </footer>
    </div>
  );
}
