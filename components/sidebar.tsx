"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BellRing,
  Calculator,
  Car,
  Columns3,
  CreditCard,
  Database,
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Plug,
  Radar,
  Scale,
  Shirt,
  ShoppingBag,
  Smile,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Building2,
  Zap,
  type LucideIcon,
} from "lucide-react";

const NAV: { section: string; items: { href: string; label: string; icon: LucideIcon; badge?: string }[] }[] = [
  {
    section: "Operação",
    items: [
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/inbox", label: "Conversas", icon: MessagesSquare },
      { href: "/funil", label: "Funil", icon: Columns3 },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
    ],
  },
  {
    section: "Automação",
    items: [
      { href: "/automacoes", label: "Cadências", icon: Zap },
      { href: "/operacoes", label: "Pedidos & cashback", icon: Calculator },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    section: "Inteligência",
    items: [
      { href: "/radar", label: "Radar", icon: Radar },
      { href: "/radar/tendencias", label: "Tendências", icon: TrendingUp },
      { href: "/radar/marcas", label: "Marcas", icon: Building2 },
      { href: "/radar/alertas", label: "Alertas", icon: BellRing },
      { href: "/radar/colecoes", label: "Coleções", icon: FolderOpen },
      { href: "/radar/campanhas", label: "Campanhas", icon: Megaphone },
      { href: "/radar/fontes", label: "Fontes", icon: Database },
    ],
  },
  {
    section: "Configuração",
    items: [
      { href: "/nichos", label: "Nichos", icon: Sparkles },
      { href: "/integracoes", label: "Integrações", icon: Plug },
    ],
  },
];

function isActive(href: string, pathname: string) {
  if (href === "/" || href === "/radar") return pathname === href;
  return pathname.startsWith(href);
}

export const VERTICAL_ICONS: Record<string, LucideIcon> = {
  building: Building2,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  tooth: Smile,
  car: Car,
  utensils: UtensilsCrossed,
  scale: Scale,
  calculator: Calculator,
};

export function Sidebar({
  mode,
  pending,
  alerts = 0,
}: {
  mode: "cloud" | "sandbox";
  pending: number;
  alerts?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-[#090d12] px-3 py-4 lg:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <span className="relative grid size-7 place-items-center rounded-[9px] bg-lime text-lime-ink">
          <Zap size={16} strokeWidth={2.6} />
        </span>
        <div className="leading-none">
          <span className="text-[15px] font-semibold tracking-tight">PRISMA IA</span>
          <span className="ml-1 text-[10px] font-medium text-dim">sales os</span>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dim/80">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex h-8 items-center gap-2.5 rounded-lg px-2 text-[12.5px] transition-colors ${
                        active
                          ? "bg-[#141d26] font-medium text-fg"
                          : "text-muted hover:bg-[#10171f] hover:text-fg"
                      }`}
                    >
                      <Icon size={15} className={active ? "text-lime" : "text-dim group-hover:text-muted"} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/automacoes" && pending > 0 && (
                        <span className="rounded-full bg-lime/15 px-1.5 text-[10px] font-semibold text-lime">
                          {pending}
                        </span>
                      )}
                      {item.href === "/radar/alertas" && alerts > 0 && (
                        <span className="rounded-full bg-amber/15 px-1.5 text-[10px] font-semibold text-amber">
                          {alerts}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-xl border border-line bg-[#0d141b] p-3">
        <div className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${mode === "cloud" ? "bg-lime live-dot" : "bg-amber"}`}
          />
          <span className="text-[11px] font-medium">
            {mode === "cloud" ? "Cloud API conectada" : "Modo sandbox"}
          </span>
        </div>
        <p className="mt-1 text-[10.5px] leading-relaxed text-dim">
          {mode === "cloud"
            ? "Mensagens saindo pelo número oficial."
            : "Nenhuma mensagem real é enviada. Configure as credenciais em Integrações."}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 px-1">
        <div className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-[#26303b] to-[#3c4a58] text-[10.5px] font-semibold">
          AP
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[11.5px] font-medium">Ana Paula</p>
          <p className="truncate text-[10px] text-dim">Gestora comercial</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const all = NAV.flatMap((group) => group.items);
  const items = ["/", "/inbox", "/funil", "/radar", "/pagamentos"]
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is (typeof all)[number] => Boolean(item));
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-line bg-[#090d12] px-3 py-2 lg:hidden">
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] ${
              active ? "bg-[#141d26] text-fg" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
