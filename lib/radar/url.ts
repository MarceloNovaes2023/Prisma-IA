import type { RadarFilters } from "./types";

const KEYS: (keyof RadarFilters)[] = [
  "q",
  "campo",
  "rede",
  "origem",
  "pais",
  "idioma",
  "genero",
  "idade",
  "desde",
  "ate",
  "visto",
  "durMin",
  "curMin",
  "curMax",
  "comMin",
  "compMin",
  "cta",
  "midia",
  "dominio",
  "marca",
  "tech",
  "oferta",
  "ordem",
  "colecao",
];

/** Serializa os filtros preservando os nomes usados na URL. */
export function filterQuery(filters: RadarFilters, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function activeFilterCount(filters: RadarFilters): number {
  return KEYS.filter((key) => key !== "ordem" && Boolean(filters[key])).length;
}
