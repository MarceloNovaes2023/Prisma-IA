"use client";

import { useEffect, useRef } from "react";

export function ScrollToBottom({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [children]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
