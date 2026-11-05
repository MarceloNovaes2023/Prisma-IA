"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Send, Sparkles, TriangleAlert } from "lucide-react";
import { generateReplyAction, sendMessageAction } from "@/lib/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
      Enviar
    </button>
  );
}

export function Composer({
  leadId,
  suggestions,
  aiMode,
}: {
  leadId: number;
  suggestions: { label: string; text: string }[];
  aiMode: string;
}) {
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState<{ model: string; simulated: boolean; handoff: boolean; error?: string } | null>(
    null,
  );
  const [pendingAi, startAi] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="border-t border-line bg-[#0b1219] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="btn h-7 px-2 text-[10.5px]"
          disabled={pendingAi}
          onClick={() =>
            startAi(async () => {
              const result = await generateReplyAction(leadId);
              if (result.text) setBody(result.text);
              setDraft({
                model: result.model,
                simulated: result.simulated,
                handoff: result.handoff,
                error: result.error,
              });
            })
          }
        >
          {pendingAi ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-lime" />}
          {pendingAi ? "Escrevendo" : "Sugerir com IA"}
        </button>
        {suggestions.slice(0, 2).map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => setBody(suggestion.text)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-[#111a23] px-2 py-1 text-[10.5px] text-muted transition-colors hover:border-lime/40 hover:text-fg"
          >
            {suggestion.label}
          </button>
        ))}
        {aiMode === "auto" && (
          <span className="chip border-lime/30 bg-lime/10 text-lime">IA respondendo sozinha</span>
        )}
        {draft && (
          <span className="inline-flex items-center gap-1 text-[10px] text-dim">
            {draft.handoff && <TriangleAlert size={10} className="text-amber" />}
            {draft.handoff
              ? "cliente pediu humano"
              : draft.simulated
                ? "simulação local (sem chave de IA)"
                : `gerado por ${draft.model}`}
          </span>
        )}
      </div>

      <form
        ref={formRef}
        action={async (formData) => {
          await sendMessageAction(formData);
          setBody("");
          setDraft(null);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          className="textarea max-h-32 min-h-[46px] resize-none"
        />
        <SubmitButton />
      </form>
    </div>
  );
}
