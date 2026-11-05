import { getDb, type AppDb } from './db';
import { stageOf } from './verticals';

export type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  vertical: string;
  stage: string;
  score: number;
  source: string;
  tags: string;
  value: number;
  owner: string;
  city: string | null;
  answers: string;
  ai_mode: string;
  notes: string | null;
  opted_in: number;
  created_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
};

export type Message = {
  id: number;
  lead_id: number;
  direction: 'in' | 'out';
  body: string;
  status: string;
  template_key: string | null;
  provider_id: string | null;
  author: string;
  created_at: string;
};

export type Followup = {
  id: number;
  lead_id: number;
  step: number;
  due_at: string;
  status: string;
  template: string;
  sent_at: string | null;
};

export type Order = {
  id: number;
  lead_id: number;
  code: string;
  description: string;
  total: number;
  status: string;
  carrier: string | null;
  tracking: string | null;
  cashback: number;
  cashback_status: string;
  created_at: string;
  delivered_at: string | null;
};

export type Broadcast = {
  id: number;
  name: string;
  vertical: string | null;
  stage_filter: string | null;
  template: string;
  total: number;
  sent: number;
  status: string;
  created_at: string;
};

export type Event = {
  id: number;
  lead_id: number | null;
  type: string;
  detail: string;
  created_at: string;
};

const plain = <T>(row: Record<string, unknown>): T => ({ ...row }) as T;

async function all<T>(db: AppDb, sql: string, ...params: (string | number | null)[]): Promise<T[]> {
  return (await db.prepare(sql).all(...params)).map((row) => plain<T>(row));
}
async function one<T>(db: AppDb, sql: string, ...params: (string | number | null)[]): Promise<T | undefined> {
  const row = await db.prepare(sql).first(...params);
  return row ? plain<T>(row) : undefined;
}

export type Overview = {
  kpis: {
    leads: number;
    leadsNew7d: number;
    activeConversations: number;
    qualifiedRate: number;
    pipeline: number;
    forecast: number;
    wonRevenue: number;
    avgScore: number;
    avgFirstResponse: number;
    cashbackDistributed: number;
    followupsDue: number;
    hotLeads: number;
    repeatRate: number;
    reactivationRate: number;
    avgDealCycle: number;
  };
  funnel: { stage: string; label: string; count: number; value: number; prob: number }[];
  byVertical: { vertical: string; leads: number; won: number; revenue: number; conversion: number; ticket: number }[];
  sources: { source: string; leads: number; won: number }[];
  daily: { day: string; leads: number; messages: number }[];
  stageDistribution: { vertical: string; stage: string; count: number }[];
  activity: (Event & { lead_name: string | null })[];
  alerts: { leadId: number; name: string; vertical: string; kind: string; detail: string; minutes: number }[];
};

export async function getOverview(): Promise<Overview> {
  const db = await getDb();
  const kpis = (await one<{
    leads: number;
    leadsNew7d: number;
    qualified: number;
    pipeline: number;
    wonRevenue: number;
    avgScore: number;
  }>(db,
    `SELECT
      COUNT(*) AS leads,
      SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS leadsNew7d,
      SUM(CASE WHEN score >= 75 THEN 1 ELSE 0 END) AS qualified,
      SUM(CASE WHEN stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno') THEN COALESCE(value,0) ELSE 0 END) AS pipeline,
      SUM(CASE WHEN stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno') THEN COALESCE(value,0) ELSE 0 END) AS wonRevenue,
      AVG(score) AS avgScore
     FROM leads`)) ?? { leads: 0, leadsNew7d: 0, qualified: 0, pipeline: 0, wonRevenue: 0, avgScore: 0 };

  const activeConversations = (await one<{ n: number }>(db,
    `SELECT COUNT(DISTINCT lead_id) AS n FROM messages WHERE created_at >= datetime('now','-7 days')`))?.n ?? 0;

  const hotLeads = (await one<{ n: number }>(db,
    `SELECT COUNT(*) AS n FROM leads WHERE score >= 75 AND stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno')`))?.n ?? 0;

  const followupsDue = (await one<{ n: number }>(db,
    `SELECT COUNT(*) AS n FROM followups WHERE status = 'pending' AND due_at <= datetime('now')`))?.n ?? 0;

  const cashbackDistributed = (await one<{ n: number }>(db,
    `SELECT COALESCE(SUM(cashback),0) AS n FROM orders WHERE cashback_status IN ('credited','redeemed')`))?.n ?? 0;

  const avgFirstResponse = (await one<{ n: number }>(db,
    `SELECT ROUND(AVG((julianday(first_out) - julianday(created_at)) * 24 * 60)) AS n FROM (
       SELECT l.id, l.created_at, MIN(m.created_at) AS first_out
       FROM leads l JOIN messages m ON m.lead_id = l.id AND m.direction = 'out'
       GROUP BY l.id
     )`))?.n ?? 0;

  const funnel = (await all<{ stage: string; count: number; value: number }>(db,
    `SELECT stage, COUNT(*) AS count, COALESCE(SUM(value),0) AS value FROM leads GROUP BY stage`)).map((row) => ({
    stage: row.stage,
    label: row.stage,
    count: row.count,
    value: row.value,
    prob: 0,
  }));

  const byVertical = (await all<{ vertical: string; leads: number; won: number; revenue: number }>(db,
    `SELECT vertical,
            COUNT(*) AS leads,
            SUM(CASE WHEN stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno') THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno') THEN COALESCE(value,0) ELSE 0 END) AS revenue
     FROM leads GROUP BY vertical ORDER BY revenue DESC`)).map((row) => ({
    ...row,
    conversion: row.leads === 0 ? 0 : (row.won / row.leads) * 100,
    ticket: row.won === 0 ? 0 : row.revenue / row.won,
  }));

  const sources = await all<{ source: string; leads: number; won: number }>(db,
    `SELECT source, COUNT(*) AS leads,
            SUM(CASE WHEN stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno') THEN 1 ELSE 0 END) AS won
     FROM leads GROUP BY source ORDER BY leads DESC LIMIT 8`);

  const daily = (await all<{ day: string; leads: number }>(db,
    `SELECT date(created_at) AS day, COUNT(*) AS leads FROM leads
     WHERE created_at >= datetime('now','-13 days') GROUP BY day ORDER BY day`)).map(async (row) => {
    const messages = (await one<{ n: number }>(db,
      `SELECT COUNT(*) AS n FROM messages WHERE date(created_at) = ?`, row.day))?.n ?? 0;
    return { ...row, messages };
  });
  const dailyResolved = await Promise.all(daily);

  const stageDistribution = await all<{ vertical: string; stage: string; count: number }>(db,
    `SELECT vertical, stage, COUNT(*) AS count FROM leads GROUP BY vertical, stage`);

  const activity = await all<Event & { lead_name: string | null }>(db,
    `SELECT e.*, l.name AS lead_name FROM events e LEFT JOIN leads l ON l.id = e.lead_id
     ORDER BY e.created_at DESC LIMIT 8`);

  const alerts = await all<{
    leadId: number;
    name: string;
    vertical: string;
    kind: string;
    detail: string;
    minutes: number;
  }>(db,
    `SELECT l.id AS leadId, l.name, l.vertical,
            'sem_resposta' AS kind,
            'Cliente respondeu e ninguém retornou' AS detail,
            CAST((julianday('now') - julianday(l.last_inbound_at)) * 24 * 60 AS INTEGER) AS minutes
     FROM leads l
     WHERE l.last_inbound_at IS NOT NULL
       AND (l.last_outbound_at IS NULL OR l.last_inbound_at > l.last_outbound_at)
       AND l.stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno')
     ORDER BY l.last_inbound_at ASC LIMIT 4`);

  const repeatLeads = (await one<{ n: number }>(db,
    `SELECT COUNT(DISTINCT l.id) AS n FROM leads l
     JOIN orders o ON o.lead_id = l.id
     WHERE l.created_at < datetime('now','-30 days')
       AND l.stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno')
       AND EXISTS (
         SELECT 1 FROM orders o2
         WHERE o2.lead_id = l.id
           AND o2.created_at > l.created_at
           AND o2.cashback_status IN ('credited','redeemed')
       )`))?.n ?? 0;

  const reactivatedLeads = (await one<{ n: number }>(db,
    `SELECT COUNT(DISTINCT l.id) AS n FROM leads l
     JOIN followups f ON f.lead_id = l.id
     WHERE f.status = 'done'
       AND f.template LIKE '%reativ%'
       AND l.created_at < datetime('now','-60 days')
       AND l.stage NOT IN ('fechado','perdido','entregue','vendido','ativo','onboarding','recompra','retorno')`))?.n ?? 0;

  const avgDealCycle = (await one<{ n: number }>(db,
    `SELECT ROUND(AVG((julianday(o.delivered_at) - julianday(l.created_at)) * 24 * 60)) AS n
     FROM leads l
     JOIN orders o ON o.lead_id = l.id
     WHERE o.delivered_at IS NOT NULL
       AND l.stage IN ('fechado','entregue','vendido','ativo','onboarding','recompra','retorno')`))?.n ?? 0;

  return {
    kpis: {
      leads: kpis.leads,
      leadsNew7d: kpis.leadsNew7d,
      activeConversations,
      qualifiedRate: kpis.leads === 0 ? 0 : (kpis.qualified / kpis.leads) * 100,
      pipeline: kpis.pipeline,
      wonRevenue: kpis.wonRevenue,
      avgScore: Math.round(kpis.avgScore ?? 0),
      avgFirstResponse,
      cashbackDistributed,
      followupsDue,
      hotLeads,
      repeatRate: kpis.leads === 0 ? 0 : (repeatLeads / kpis.leads) * 100,
      reactivationRate: kpis.leads === 0 ? 0 : (reactivatedLeads / kpis.leads) * 100,
      avgDealCycle,
      forecast: await forecastValue(db),
    },
    funnel,
    byVertical,
    sources,
    daily: dailyResolved,
    stageDistribution,
    activity,
    alerts,
  };
}

async function forecastValue(db: AppDb): Promise<number> {
  const rows = await all<{ vertical: string; stage: string; value: number }>(db,
    "SELECT vertical, stage, COALESCE(value,0) AS value FROM leads");
  let total = 0;
  for (const row of rows) {
    const stage = stageOf(row.vertical, row.stage);
    if (!stage || stage.kind === "lost" || stage.kind === "won") continue;
    total += (row.value * stage.prob) / 100;
  }
  return Math.round(total);
}

export async function listLeads(filters?: {
  vertical?: string;
  stage?: string;
  owner?: string;
  q?: string;
  minScore?: number;
  limit?: number;
}): Promise<Lead[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filters?.vertical) { clauses.push("vertical = ?"); params.push(filters.vertical); }
  if (filters?.stage) { clauses.push("stage = ?"); params.push(filters.stage); }
  if (filters?.owner) { clauses.push("owner = ?"); params.push(filters.owner); }
  if (filters?.q) {
    clauses.push("(name LIKE ? OR phone LIKE ? OR tags LIKE ?)");
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters?.minScore) { clauses.push("score >= ?"); params.push(filters.minScore); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters?.limit ?? 400;
  return await all<Lead>(db,
    `SELECT * FROM leads ${where} ORDER BY score DESC, COALESCE(last_inbound_at, created_at) DESC LIMIT ${limit}`,
    ...params);
}

export async function getLead(id: number): Promise<Lead | undefined> {
  return await one<Lead>(await getDb(), "SELECT * FROM leads WHERE id = ?", id);
}

export async function getMessages(leadId: number): Promise<Message[]> {
  return await all<Message>(await getDb(), "SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC, id ASC", leadId);
}

export async function getFollowups(leadId?: number): Promise<Followup[]> {
  const db = await getDb();
  if (leadId) {
    return await all<Followup>(db, "SELECT * FROM followups WHERE lead_id = ? ORDER BY due_at ASC", leadId);
  }
  return await all<Followup>(db,
    `SELECT * FROM followups ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, due_at ASC LIMIT 200`);
}

export async function getOrders(leadId?: number): Promise<(Order & { lead_name: string; vertical: string })[]> {
  const db = await getDb();
  const where = leadId ? "WHERE o.lead_id = ?" : "";
  const params = leadId ? [leadId] : [];
  return await all<Order & { lead_name: string; vertical: string }>(db,
    `SELECT o.*, l.name AS lead_name, l.vertical AS vertical
     FROM orders o JOIN leads l ON l.id = o.lead_id ${where}
     ORDER BY o.created_at DESC LIMIT 200`,
    ...params);
}

export async function listConversations(): Promise<{
  lead: Lead;
  lastMessage: string;
  lastAt: string;
  unread: number;
  vertical: string;
}[]> {
  const db = await getDb();
  const leads = await all<Lead>(db,
    `SELECT * FROM leads ORDER BY COALESCE(last_inbound_at, last_outbound_at, created_at) DESC LIMIT 80`);
  const out = [];
  for (const lead of leads) {
    const last = await one<{ body: string; created_at: string; direction: string }>(db,
      "SELECT body, created_at, direction FROM messages WHERE lead_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
      lead.id);
    const unread = lead.last_inbound_at && (!lead.last_outbound_at || lead.last_inbound_at > lead.last_outbound_at) ? 1 : 0;
    out.push({ lead, lastMessage: last?.body ?? "Sem mensagens ainda", lastAt: last?.created_at ?? lead.created_at, unread, vertical: lead.vertical });
  }
  return out;
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  return await all<Broadcast>(await getDb(), "SELECT * FROM broadcasts ORDER BY created_at DESC");
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await one<{ value: string }>(await getDb(), "SELECT value FROM settings WHERE key = ?", key))?.value;
}

export type ReportData = {
  byVertical: { vertical: string; leads: number; qualified: number; won: number; revenue: number; conversion: number; ticket: number }[];
  bySource: { source: string; leads: number; won: number; conversion: number; revenue: number }[];
  byOwner: { owner: string; leads: number; won: number; revenue: number; conversion: number }[];
  weekly: { week: string; leads: number; won: number; revenue: number }[];
  cashback: { total: number; pending: number; credited: number; redeemed: number; orders: number }[];
  sla: { owner: string; minutes: number; conversations: number }[];
};

export async function getReports(): Promise<ReportData> {
  const db = await getDb();
  const won = "'fechado','entregue','vendido','ativo','onboarding','recompra','retorno'";

  const byVertical = (await all<{ vertical: string; leads: number; qualified: number; won: number; revenue: number }>(db,
    `SELECT vertical, COUNT(*) AS leads,
            SUM(CASE WHEN score >= 75 THEN 1 ELSE 0 END) AS qualified,
            SUM(CASE WHEN stage IN (${won}) THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage IN (${won}) THEN COALESCE(value,0) ELSE 0 END) AS revenue
     FROM leads GROUP BY vertical ORDER BY revenue DESC`)).map((row) => ({
    ...row,
    conversion: row.leads === 0 ? 0 : (row.won / row.leads) * 100,
    ticket: row.won === 0 ? 0 : row.revenue / row.won,
  }));

  const bySource = (await all<{ source: string; leads: number; won: number; revenue: number }>(db,
    `SELECT source, COUNT(*) AS leads,
            SUM(CASE WHEN stage IN (${won}) THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage IN (${won}) THEN COALESCE(value,0) ELSE 0 END) AS revenue
     FROM leads GROUP BY source ORDER BY revenue DESC LIMIT 10`)).map((row) => ({
    ...row,
    conversion: row.leads === 0 ? 0 : (row.won / row.leads) * 100,
  }));

  const byOwner = (await all<{ owner: string; leads: number; won: number; revenue: number }>(db,
    `SELECT owner, COUNT(*) AS leads,
            SUM(CASE WHEN stage IN (${won}) THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage IN (${won}) THEN COALESCE(value,0) ELSE 0 END) AS revenue
     FROM leads GROUP BY owner ORDER BY revenue DESC`)).map((row) => ({
    ...row,
    conversion: row.leads === 0 ? 0 : (row.won / row.leads) * 100,
  }));

  const weekly = (await all<{ week: string; leads: number; won: number; revenue: number }>(db,
    `SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS leads,
            SUM(CASE WHEN stage IN (${won}) THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage IN (${won}) THEN COALESCE(value,0) ELSE 0 END) AS revenue
     FROM leads GROUP BY week ORDER BY week DESC LIMIT 6`)).reverse();

  const cashback = (await one<{ total: number; pending: number; credited: number; redeemed: number; orders: number }>(db,
    `SELECT COALESCE(SUM(cashback),0) AS total,
            COALESCE(SUM(CASE WHEN cashback_status = 'pending' THEN cashback ELSE 0 END),0) AS pending,
            COALESCE(SUM(CASE WHEN cashback_status = 'credited' THEN cashback ELSE 0 END),0) AS credited,
            COALESCE(SUM(CASE WHEN cashback_status = 'redeemed' THEN cashback ELSE 0 END),0) AS redeemed,
            COUNT(*) AS orders
     FROM orders`)) ?? { total: 0, pending: 0, credited: 0, redeemed: 0, orders: 0 };

  const sla = await all<{ owner: string; minutes: number; conversations: number }>(db,
    `SELECT owner,
            ROUND(AVG((julianday(first_out) - julianday(created_at)) * 24 * 60)) AS minutes,
            COUNT(*) AS conversations
     FROM (
       SELECT l.id, l.owner, l.created_at, MIN(m.created_at) AS first_out
       FROM leads l JOIN messages m ON m.lead_id = l.id AND m.direction = 'out'
       GROUP BY l.id
     ) GROUP BY owner ORDER BY minutes ASC`);

  return { byVertical, bySource, byOwner, weekly, cashback, sla };
}

export type SettingsMap = Record<string, string>;

export async function getSettings(): Promise<SettingsMap> {
  const rows = await all<{ key: string; value: string }>(await getDb(), "SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
