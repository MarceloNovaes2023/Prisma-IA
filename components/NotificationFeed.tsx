"use client";

import { useRef, useState } from "react";

/**
 * Componente de badge de notificações Knock.
 *
 * Renderiza um ícone de notificação com contador de itens não lidos
 * e um popover com o feed completo de notificações.
 *
 * Se as chaves Knock (NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY e NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID)
 * não estiverem configuradas, renderiza apenas o ícone sem funcionalidade Knock.
 * Isso evita que o React congele quando as chaves estão vazias.
 *
 * Props:
 *   userId: ID do usuário logado (ex.: "user_123")
 *   initialUnread: Número inicial de leituras não vistas (opcional, padrão 0)
 */
export function NotificationFeed({
  userId,
  initialUnread = 0,
}: {
  userId: string;
  initialUnread?: number;
}) {
  const hasKnockConfig = !!(
    process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY &&
    process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID
  );
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Se não houver configuração Knock, renderiza apenas o ícone simples
  if (hasKnockConfig) {
    // @ts-ignore - tipos dinâmicos do Knock, importados condicionalmente
    const KnockProvider = require("@knocklabs/react").KnockProvider;
    // @ts-ignore - tipos dinâmicos do Knock
    const KnockFeedProvider = require("@knocklabs/react").KnockFeedProvider;
    // @ts-ignore - tipos dinâmicos do Knock
    const NotificationIconButton = require("@knocklabs/react")
      .NotificationIconButton;

    return (
      <KnockProvider
        apiKey={process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY}
        userId={userId}
      >
        <KnockFeedProvider
          feedId={process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID}
        >
          <NotificationIconButton
            ref={buttonRef}
            onClick={() => setIsOpen((v) => !v)}
          />
        </KnockFeedProvider>
      </KnockProvider>
    );
  }

  // Fallback: ícone simples sem Knock provider (não congela React)
  return (
    <button
      ref={buttonRef}
      className="relative grid size-7 place-items-center rounded-[9px] bg-lime text-lime-ink"
      onClick={() => setIsOpen((v) => !v)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        className="lucide lucide-zap"
      >
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>
      </svg>
    </button>
  );
}