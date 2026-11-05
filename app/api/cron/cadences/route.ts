import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { nowStamp } from "@/lib/format";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const due = db
    .prepare(
      `SELECT f.id, f.lead_id, f.step, f.template, l.phone
       FROM followups f JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending' AND f.due_at <= datetime('now')
         AND l.stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno')
       ORDER BY f.due_at ASC LIMIT 40`,
    )
    .all() as { id: number; lead_id: number; step: number; template: string; phone: string }[];

  let sent = 0;
  for (const row of due) {
    const result = await sendWhatsAppText(row.phone, row.template);
    if (result.ok) sent += 1;
    db.prepare(
      "INSERT INTO messages (lead_id, direction, body, status, template_key, provider_id, created_at) VALUES (?, 'out', ?, ?, ?, ?, ?)",
    ).run(
      row.lead_id,
      row.template,
      result.ok ? "delivered" : "failed",
      `cadência ${row.step + 1}`,
      result.providerId ?? null,
      nowStamp(),
    );
    db.prepare("UPDATE followups SET status = 'done', sent_at = ? WHERE id = ?").run(nowStamp(), row.id);
    db.prepare("UPDATE leads SET last_outbound_at = ? WHERE id = ?").run(nowStamp(), row.lead_id);
  }

  if (due.length > 0) {
    db.prepare("INSERT INTO events (lead_id, type, detail, created_at) VALUES (NULL, 'cadence.run', ?, ?)").run(
      `Cron · ${sent} follow-ups enviados`,
      nowStamp(),
    );
  }

  return NextResponse.json({ due: due.length, sent, ranAt: nowStamp() });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
