import type { ReactionSet } from "./types";

export function parseReactions(raw: string | null): ReactionSet {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<ReactionSet>;
    return {
      like: parsed.like ?? 0,
      love: parsed.love ?? 0,
      haha: parsed.haha ?? 0,
      wow: parsed.wow ?? 0,
      sad: parsed.sad ?? 0,
      angry: parsed.angry ?? 0,
    };
  } catch {
    return { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
  }
}

export function parseComments(raw: string | null): { author: string; text: string; likes: number }[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.text === "string");
  } catch {
    return [];
  }
}

export function parseRedirects(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseTech(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSeriesSafe(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "number") : [];
  } catch {
    return [];
  }
}
