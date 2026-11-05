import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISMA IA · Sales OS no WhatsApp",
  description:
    "Automação de vendas por WhatsApp para imobiliárias, moda, clínicas, automotivo, restaurantes, advocacia e contabilidade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
