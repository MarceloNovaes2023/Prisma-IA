"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, MessageSquare } from "lucide-react";
import { moveStageAction } from "@/lib/actions";
import { Avatar, Badge, Score } from "@/components/ui";
import { brl, relativeTime } from "@/lib/format";
import type { Lead } from "@/lib/queries";

type StageColumn = { key: string; label: string; prob: number; kind?: string };

export function Kanban({
  stages,
  leads,
  color,
}: {
  stages: StageColumn[];
  leads: Lead[];
  color: string;
}) {
  const [optimisticLeads, moveOptimistic] = useOptimistic(
    leads,
    (state: Lead[], change: { leadId: number; stage: string }) =>
      state.map((lead) => (lead.id === change.leadId ? { ...lead, stage: change.stage } : lead)),
  );
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleDrop(stage: string, leadId: number) {
    startTransition(async () => {
      moveOptimistic({ leadId, stage });
      const formData = new FormData();
      formData.set("leadId", String(leadId));
      formData.set("stage", stage);
      await moveStageAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const columnLeads = optimisticLeads.filter((lead) => lead.stage === stage.key);
        const total = columnLeads.reduce((acc, lead) => acc + lead.value, 0);
        return (
          <div
            key={stage.key}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const leadId = Number(event.dataTransfer.getData("text/plain"));
              if (leadId) handleDrop(stage.key, leadId);
            }}
            className="flex w-[248px] shrink-0 flex-col rounded-xl border border-line bg-[#0b1117]"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[11.5px] font-semibold">{stage.label}</span>
              </div>
              <span className="rounded-full bg-white/5 px-1.5 text-[10px] tabular-nums text-dim">
                {columnLeads.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-dim">
              <span className="tabular-nums">{brl(total, true)}</span>
              <span>{stage.prob}%</span>
            </div>
            <div className="scroll-area min-h-[120px] flex-1 space-y-2 px-2 pb-2">
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", String(lead.id));
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="group cursor-grab rounded-lg border border-line bg-[#111a23] p-2.5 transition-colors hover:border-[#2d3c4b] active:cursor-grabbing"
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical size={11} className="mt-0.5 shrink-0 text-dim/50" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/inbox?lead=${lead.id}`}
                          className="truncate text-[11.5px] font-medium hover:text-lime"
                        >
                          {lead.name}
                        </Link>
                        {lead.last_inbound_at &&
                          (!lead.last_outbound_at || lead.last_inbound_at > lead.last_outbound_at) && (
                            <span className="size-1.5 shrink-0 rounded-full bg-lime" />
                          )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-dim">
                        {lead.source} · {relativeTime(lead.last_inbound_at ?? lead.created_at)}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10.5px] tabular-nums text-muted">{brl(lead.value, true)}</span>
                        <Score value={lead.score} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 border-t border-line-soft pt-1.5">
                    <Avatar name={lead.owner} size={16} />
                    <span className="truncate text-[9.5px] text-dim">{lead.owner}</span>
                    <Link
                      href={`/inbox?lead=${lead.id}`}
                      className="ml-auto text-dim transition-colors hover:text-lime"
                      aria-label="Abrir conversa"
                    >
                      <MessageSquare size={11} />
                    </Link>
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && (
                <div className="grid h-[80px] place-items-center rounded-lg border border-dashed border-line/70 text-[10px] text-dim">
                  Solte um lead aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VerticalChips({
  verticals,
  active,
  basePath,
}: {
  verticals: { slug: string; short: string; color: string }[];
  active: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {verticals.map((vertical) => (
        <Link
          key={vertical.slug}
          href={`${basePath}?vertical=${vertical.slug}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            active === vertical.slug
              ? "border-line bg-[#18222d] text-fg"
              : "border-transparent text-muted hover:bg-[#121a23]"
          }`}
        >
          <span className="size-1.5 rounded-full" style={{ background: vertical.color }} />
          {vertical.short}
        </Link>
      ))}
      <Badge tone="neutral">+ indicação</Badge>
    </div>
  );
}
