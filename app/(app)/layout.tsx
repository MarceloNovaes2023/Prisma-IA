import { MobileNav, Sidebar } from "@/components/sidebar";
import { getDb } from "@/lib/db";
import { unreadAlerts } from "@/lib/radar/track";
import { getProvider } from "@/lib/whatsapp";
import { NotificationFeed } from "@/components/NotificationFeed";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let pending = 0;
  try {
    const db = await getDb();
    const row = await db.prepare("SELECT COUNT(*) AS n FROM followups WHERE status = 'pending' AND due_at <= datetime('now')").first() as { n: number } | null;
    pending = row?.n ?? 0;
  } catch {
    pending = 0;
  }

  let alerts = 0;
  try {
    alerts = await unreadAlerts();
  } catch {
    alerts = 0;
  }

  const hasKnockConfig = !!(process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY && process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID);

  return (
    <div className="flex min-h-screen">
      <Sidebar mode={getProvider().mode} pending={pending} alerts={alerts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">{children}</main>
        {hasKnockConfig ? (
          <NotificationFeed userId="user_123" initialUnread={alerts} />
        ) : (
          <div className="flex items-center gap-2" style={{ color: "dimtext" }}>
            <span className="text-[10px] text-dim">Modo sandbox (Knock não configurado)</span>
          </div>
        )}
      </div>
    </div>
  );
}
