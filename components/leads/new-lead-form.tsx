"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { createLeadAction } from "@/lib/actions";
import { VERTICALS, renderTemplate, scoreLead } from "@/lib/verticals";
import { Card } from "@/components/ui";

const OWNERS = ["Ana Paula", "Rafael Lima", "Juliana Souza", "Marcos Vieira", "Camila Rocha", "Diego Martins"];

export function NewLeadForm() {
  const [verticalSlug, setVerticalSlug] = useState(VERTICALS[0].slug);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState(OWNERS[0]);
  const [city, setCity] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const vertical = VERTICALS.find((item) => item.slug === verticalSlug)!;
  const score = scoreLead(verticalSlug, answers);
  const greeting = renderTemplate(vertical.greeting, {
    primeiro_nome: name.split(" ")[0] || "cliente",
    nome: name || "cliente",
    vendedor: owner.split(" ")[0],
    empresa: "sua empresa",
    bairro: city || "seu bairro",
    peca: "a peça",
    procedimento: answers[vertical.qualification[0].key] ?? "o procedimento",
    veiculo: "o veículo",
  });

  return (
    <form action={createLeadAction} className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">Dados do lead</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nome completo</label>
              <input
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="Ex.: Bruna Almeida"
              />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input name="phone" required className="input" placeholder="+55 11 98765-4321" />
            </div>
            <div>
              <label className="label">Nicho</label>
              <select
                name="vertical"
                value={verticalSlug}
                onChange={(event) => {
                  setVerticalSlug(event.target.value);
                  setAnswers({});
                }}
                className="select"
              >
                {VERTICALS.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Origem</label>
              <select name="source" className="select" defaultValue={vertical.playbook.channels[0]}>
                {vertical.playbook.channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
                <option value="Indicação">Indicação</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="label">Responsável</label>
              <select
                name="owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className="select"
              >
                {OWNERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cidade / bairro</label>
              <input
                name="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="input"
                placeholder="São Paulo"
              />
            </div>
            <div>
              <label className="label">Valor potencial (R$)</label>
              <input name="value" type="number" min="0" step="100" className="input" defaultValue={0} />
            </div>
            <div>
              <label className="label">E-mail (opcional)</label>
              <input name="email" type="email" className="input" placeholder="cliente@email.com" />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
              Qualificação · {vertical.short}
            </p>
            <span className="chip">
              score estimado <strong className="ml-1 text-lime">{score}</strong>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {vertical.qualification.map((question) => (
              <div key={question.key}>
                <label className="label">{question.label}</label>
                <select
                  name={`q_${question.key}`}
                  className="select"
                  value={answers[question.key] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                  }
                >
                  <option value="">Selecionar</option>
                  {question.options.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] leading-relaxed text-dim">
            O score é ponderado por pergunta (peso de cada critério varia por nicho) e define a prioridade nas
            cadências.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-lime/25 bg-[#101a12]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-lime/80">
            <Sparkles size={12} /> Mensagem de abertura
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#0b1210] p-3 text-[12px] leading-relaxed text-[#dff5cd]">
            {greeting}
          </p>
          <p className="mt-2 text-[10.5px] text-lime/50">
            Enviada automaticamente na criação do lead, seguida da cadência de {vertical.cadence.length} toques.
          </p>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">Cadência aplicada</p>
          <ol className="mt-2 space-y-1.5">
            {vertical.cadence.map((step, index) => (
              <li key={step.label} className="flex gap-2 text-[11px]">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-white/5 text-[9px] text-dim">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="text-fg">{step.label}</span>
                  <span className="text-dim"> · D+{step.day}</span>
                  <span className="block text-[10px] text-dim">{step.goal}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <button type="submit" className="btn btn-primary h-10 w-full">
          <Send size={14} /> Criar lead e enviar abertura
        </button>
        <p className="text-center text-[10px] leading-relaxed text-dim">
          O lead entra com opt-in registrado. Nenhuma mensagem é enviada sem essa marcação.
        </p>
      </div>
    </form>
  );
}
