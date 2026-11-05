import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import { brl, initials } from "@/lib/format";

export type Tone = "hot" | "warm" | "cold" | "neutral" | "lime" | "violet" | "amber" | "rose" | "cyan";

const toneStyles: Record<Tone, { bg: string; fg: string; border: string }> = {
  hot: { bg: "rgba(163,240,75,0.12)", fg: "#c8ff7d", border: "rgba(163,240,75,0.28)" },
  warm: { bg: "rgba(245,184,65,0.12)", fg: "#ffd489", border: "rgba(245,184,65,0.28)" },
  cold: { bg: "rgba(139,154,168,0.1)", fg: "#a9b7c4", border: "rgba(139,154,168,0.22)" },
  neutral: { bg: "#141d26", fg: "#a9b7c4", border: "#26333f" },
  lime: { bg: "rgba(163,240,75,0.14)", fg: "#c8ff7d", border: "rgba(163,240,75,0.3)" },
  violet: { bg: "rgba(154,134,255,0.14)", fg: "#c2b6ff", border: "rgba(154,134,255,0.3)" },
  amber: { bg: "rgba(245,184,65,0.13)", fg: "#ffd489", border: "rgba(245,184,65,0.3)" },
  rose: { bg: "rgba(242,96,122,0.13)", fg: "#ff9db0", border: "rgba(242,96,122,0.3)" },
  cyan: { bg: "rgba(79,209,197,0.13)", fg: "#8ce6dd", border: "rgba(79,209,197,0.3)" },
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  const style = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-medium leading-4 whitespace-nowrap"
      style={{ background: style.bg, color: style.fg, borderColor: style.border }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: style.fg }} />}
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`card ${padded ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
        {hint && <p className="mt-0.5 text-[11.5px] text-dim">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  delta?: string;
}) {
  const style = toneStyles[tone];
  return (
    <div className="card group relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-dim">{label}</span>
        {icon && (
          <span
            className="grid size-7 place-items-center rounded-lg"
            style={{ background: style.bg, color: style.fg }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-tight">{value}</span>
        {delta && (
          <span className="text-[11px] font-medium" style={{ color: style.fg }}>
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[11.5px] text-dim">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const palettes = [
    "linear-gradient(140deg,#2b3f22,#4f7a2e)",
    "linear-gradient(140deg,#2a2f4a,#4b3f7a)",
    "linear-gradient(140deg,#3b2b33,#7a3f52)",
    "linear-gradient(140deg,#233a3d,#2f6b66)",
    "linear-gradient(140deg,#3a3222,#7a5f2e)",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % palettes.length;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white/90"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: palettes[index],
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Score({ value }: { value: number }) {
  const tone: Tone = value >= 75 ? "hot" : value >= 45 ? "warm" : "cold";
  const style = toneStyles[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-1.5 w-9 overflow-hidden rounded-full bg-white/8">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(6, value)}%`, background: style.fg }}
        />
      </span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: style.fg }}>
        {value}
      </span>
    </span>
  );
}

export function Progress({ value, color = "#a3f04b" }: { value: number; color?: string }) {
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/6">
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </span>
  );
}

export function FunnelBars({
  steps,
}: {
  steps: { label: string; count: number; conversion: number; color?: string }[];
}) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-2.5">
      {steps.map((step) => (
        <div key={step.label} className="group">
          <div className="mb-1 flex items-center justify-between text-[11.5px]">
            <span className="text-muted">{step.label}</span>
            <span className="tabular-nums text-dim">
              <span className="text-fg">{step.count}</span> · {step.conversion.toFixed(0)}%
            </span>
          </div>
          <div className="h-7 w-full overflow-hidden rounded-md bg-white/[0.03]">
            <div
              className="flex h-full items-center justify-end rounded-md pr-2 text-[10px] font-semibold text-black/70 transition-all"
              style={{
                width: `${Math.max(6, (step.count / max) * 100)}%`,
                background: step.color ?? "#a3f04b",
                opacity: 0.9,
              }}
            >
              {step.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#a3f04b",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 88 - 6;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,100 ${points.join(" ")} 100,100`}
        fill={`url(#spark-${color.replace("#", "")})`}
        stroke="none"
      />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Bars({
  data,
  format = (value: number) => String(value),
}: {
  data: { label: string; value: number; color?: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-[112px] shrink-0 truncate text-[11.5px] text-muted">{row.label}</span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, background: row.color ?? "#9a86ff" }}
            />
          </span>
          <span className="w-[68px] shrink-0 text-right text-[11.5px] tabular-nums text-dim">
            {format(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-white/5 text-dim">
        <Inbox size={16} />
      </span>
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {hint && <p className="max-w-[38ch] text-[11.5px] text-dim">{hint}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-dim">{eyebrow}</p>
        )}
        <h1 className="text-[21px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-[12.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LeadRowValue({ value }: { value: number }) {
  return <span className="tabular-nums text-[12px] text-muted">{brl(value, true)}</span>;
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-lime/90 transition-colors hover:text-lime"
    >
      {children}
      <ArrowUpRight size={12} />
    </Link>
  );
}

export { toneStyles };
