export function brl(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
    if (Math.abs(value) >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function num(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

export function parseStamp(iso: string): Date {
  // aceita "YYYY-MM-DD HH:MM:SS" (UTC, formato SQLite) e ISO completo
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso)) {
    return new Date(`${iso.replace(" ", "T")}Z`);
  }
  return new Date(iso);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = parseStamp(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} mês${months > 1 ? "es" : ""}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseStamp(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseStamp(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayLabel(iso: string): string {
  return parseStamp(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function clockTime(iso: string): string {
  return parseStamp(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function slaTone(minutes: number): "hot" | "warm" | "cold" {
  if (minutes <= 5) return "hot";
  if (minutes <= 60) return "warm";
  return "cold";
}
