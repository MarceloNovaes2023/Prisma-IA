"use client";

import { useActionState } from "react";
import { BookmarkPlus, Sparkles } from "lucide-react";
import { generateBriefAction, saveBriefAction, type BriefState } from "@/lib/radar/actions";

function renderLine(line: string, index: number) {
  if (line.startsWith("# ")) {
    return (
      <p key={index} className="mb-1 text-[13px] font-semibold text-fg">
        {line.slice(2)}
      </p>
    );
  }
  if (line.startsWith("## ")) {
    return (
      <p key={index} className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-dim">
        {line.slice(3)}
      </p>
    );
  }
  if (!line.trim()) return <span key={index} className="block h-1" />;

  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p key={index} className="text-[11.5px] leading-relaxed text-muted">
      {parts.map((part, partIndex) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={partIndex} className="font-semibold text-fg">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={partIndex}>{part}</span>
        ),
      )}
    </p>
  );
}

export function BriefPanel({ adId, collectionId }: { adId: number; collectionId?: number }) {
  const [state, formAction, pending] = useActionState<BriefState | null, FormData>(generateBriefAction, null);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="adId" value={adId} />
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          <Sparkles size={13} />
          {pending ? "Analisando o criativo…" : "Gerar briefing com IA"}
        </button>
      </form>

      {state && (
        <div className="rounded-xl border border-line bg-[#0b1219] p-3">
          {renderLine("## Resumo", 0)}
          <div className="-mt-1">{state.text.split("\n").map((line, index) => renderLine(line, index + 1))}</div>
          <p className="mt-2 border-t border-line-soft pt-2 text-[9.5px] text-dim">
            {state.simulated ? "Modo simulação local — configure AI_API_KEY para o modelo real." : `Gerado por ${state.model}.`}
          </p>

          <form action={saveBriefAction} className="mt-2">
            <input type="hidden" name="adId" value={state.adId} />
            <input type="hidden" name="text" value={state.text} />
            <input type="hidden" name="model" value={state.model} />
            <input type="hidden" name="simulated" value={state.simulated ? "1" : "0"} />
            {collectionId ? <input type="hidden" name="collectionId" value={collectionId} /> : null}
            <button type="submit" className="btn h-7 w-full text-[10.5px]">
              <BookmarkPlus size={11} />
              {collectionId ? "Salvar na prancha" : "Salvar briefing da campanha"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
