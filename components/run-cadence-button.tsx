"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, Check } from "lucide-react";
import { runCadenceAction } from "@/lib/actions";

export function RunCadenceButton({ compact = false }: { compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; considered: number } | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-lime">
          <Check size={12} /> {result.sent} enviada{result.sent === 1 ? "" : "s"}
        </span>
      )}
      <button
        type="button"
        className={compact ? "btn" : "btn btn-primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await runCadenceAction();
            setResult(outcome);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {pending ? "Executando" : "Rodar motor"}
      </button>
    </div>
  );
}
