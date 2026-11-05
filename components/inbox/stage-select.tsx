"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveStageAction } from "@/lib/actions";

export function StageSelect({
  leadId,
  stage,
  options,
}: {
  leadId: number;
  stage: string;
  options: { key: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      className="select h-8 w-auto min-w-[140px] py-0 text-[11.5px]"
      value={stage}
      disabled={pending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("leadId", String(leadId));
        formData.set("stage", event.target.value);
        startTransition(async () => {
          await moveStageAction(formData);
          router.refresh();
        });
      }}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
