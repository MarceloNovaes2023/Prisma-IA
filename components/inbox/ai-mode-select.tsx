"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { setAiModeAction } from "@/lib/actions";

const LABEL: Record<string, string> = {
  auto: "IA responde sozinha",
  copilot: "IA sugere, humano envia",
  off: "IA desligada",
};

export function AiModeSelect({ leadId, mode }: { leadId: number; mode: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5">
      <Bot size={11} className={mode === "off" ? "text-dim" : "text-lime"} />
      <select
        className="select h-7 w-auto min-w-[142px] py-0 text-[10.5px]"
        value={mode}
        disabled={pending}
        onChange={(event) => {
          const formData = new FormData();
          formData.set("leadId", String(leadId));
          formData.set("aiMode", event.target.value);
          startTransition(async () => {
            await setAiModeAction(formData);
            router.refresh();
          });
        }}
      >
        {Object.entries(LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
