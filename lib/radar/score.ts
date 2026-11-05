import { createHash } from "node:crypto";

/** Normaliza o texto do anúncio para comparação: sem acento, sem emoji, sem link. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Impressão digital do criativo: as primeiras 24 palavras relevantes do título + corpo.
 * Serve para agrupar o mesmo anúncio rodando em contas diferentes (clones) e medir saturação.
 */
export function fingerprintOf(headline: string | null, body: string): string {
  const words = normalizeText(`${headline ?? ""} ${body}`)
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 24)
    .join(" ");
  return createHash("sha1").update(words).digest("hex").slice(0, 16);
}

export function parseDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.length === 10 ? `${value}T00:00:00Z` : `${value.replace(" ", "T")}Z`;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : null;
}

export function daysRunning(ad: { start_date: string; stop_date: string | null }): number {
  const start = parseDay(ad.start_date);
  if (!start) return 1;
  const end = parseDay(ad.stop_date) ?? Date.now();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function dateOnly(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

/** Gera a curva de curtidas acumuladas (30 pontos, do mais antigo ao mais recente). */
export function buildSeries(totalLikes: number, days: number, shape: "steady" | "spike" | "late" | "flat"): number[] {
  const points = 30;
  const step = Math.max(1, Math.round(days / points));
  const values: number[] = [];
  let accumulated = totalLikes * 0.35;
  values.push(Math.round(accumulated));
  for (let i = 1; i < points; i++) {
    const progress = i / (points - 1);
    let factor = 1 / points;
    if (shape === "spike") factor = progress > 0.72 ? 0.12 : 0.035;
    else if (shape === "late") factor = progress > 0.6 ? 0.1 : 0.02;
    else if (shape === "flat") factor = 0.005;
    const wobble = 0.85 + ((i * 37) % 30) / 100;
    accumulated += (totalLikes * 0.65) * factor * wobble;
    values.push(Math.round(Math.min(totalLikes, accumulated)));
  }
  values[values.length - 1] = totalLikes;
  // garante monotonicidade
  for (let i = 1; i < values.length; i++) if (values[i] < values[i - 1]) values[i] = values[i - 1];
  return values;
}

export function parseSeries(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/** Aceleração: curtidas/dia nos últimos 7 dias ÷ média desde o início. 1 = estável. */
export function momentumOf(series: number[], days: number, likes: number): number {
  if (series.length < 8 || likes <= 0) return 1;
  const last = series[series.length - 1];
  const weekAgo = series[series.length - 8];
  const recentPerDay = Math.max(0, last - weekAgo) / 7;
  const lifetimePerDay = likes / Math.max(days, 1);
  if (lifetimePerDay <= 0) return 1;
  return Math.min(4, Math.max(0, recentPerDay / lifetimePerDay));
}

export type ScoreParts = {
  longevity: number;
  velocity: number;
  acceleration: number;
  scale: number;
  craft: number;
  saturation: number;
};

export type ScoreInput = {
  days: number;
  likes: number;
  comments: number;
  shares: number;
  momentum: number;
  variants: number;
  copies: number;
  hasLanding: boolean;
  hasTitle: boolean;
  hasTech: boolean;
  hasCta: boolean;
  active: boolean;
};

/**
 * "Winning Score": substitui a ordenação por curtidas cruas do AdSpy.
 * Curtida comprada e anúncio recém-lançado não passam; tempo no ar com aceleração, sim.
 */
export function winningScore(input: ScoreInput): { score: number; parts: ScoreParts } {
  const likesPerDay = input.likes / Math.max(1, input.days);
  const engagementPerDay = (input.likes + input.comments * 4 + input.shares * 6) / Math.max(1, input.days);

  const longevity = 32 * Math.min(1, Math.log1p(input.days) / Math.log1p(120));
  const velocity = 26 * Math.min(1, Math.log1p(engagementPerDay) / Math.log1p(900));
  const acceleration = 18 * Math.min(1, input.momentum / 2);
  const scale = 14 * Math.min(1, Math.max(0, input.variants - 1) / 6);
  const craft = (input.hasLanding ? 3.5 : 0) + (input.hasTitle ? 2.5 : 0) + (input.hasTech ? 2 : 0) + (input.hasCta ? 2 : 0);
  const saturation = -10 * Math.min(1, input.copies / 6);
  const activeBonus = input.active ? 3 : 0;

  const parts = { longevity, velocity, acceleration, scale, craft, saturation };
  const raw = longevity + velocity + acceleration + scale + craft + saturation + activeBonus;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  // evita variável não usada em builds estritos
  void likesPerDay;
  return { score: score, parts };
}

export const orderOptions = [
  { value: "score", label: "Winning Score" },
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "duracao", label: "Rodando há mais tempo" },
  { value: "aceleracao", label: "Aceleração" },
  { value: "curtidas", label: "Curtidas" },
  { value: "compartilhamentos", label: "Compartilhamentos" },
  { value: "comentarios", label: "Comentários" },
] as const;

export type OrderValue = (typeof orderOptions)[number]["value"];

export function scoreTone(score: number): "hot" | "warm" | "cold" {
  if (score >= 72) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(".", ",")} mil`;
  return String(value);
}

export function initialsOf(name: string): string {
  return name
    .replace(/[^\p{L}\s]/gu, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
