import type { AppDb } from '@/lib/db';
import { getDb } from '@/lib/db';

const RADAR_SCHEMA = `
CREATE TABLE IF NOT EXISTS radar_ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  advertiser_id TEXT,
  page_verified INTEGER NOT NULL DEFAULT 0,
  network TEXT NOT NULL,
  start_date TEXT NOT NULL,
  stop_date TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  country TEXT NOT NULL DEFAULT 'BR',
  language TEXT NOT NULL DEFAULT 'pt',
  gender TEXT,
  age_min INTEGER,
  age_max INTEGER,
  media_type TEXT NOT NULL DEFAULT 'image',
  cta TEXT,
  headline TEXT,
  body TEXT NOT NULL,
  description TEXT,
  landing_url TEXT,
  landing_domain TEXT,
  landing_title TEXT,
  redirect_chain TEXT,
  tech_stack TEXT,
  offer_id TEXT,
  affiliate_network TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  reactions TEXT NOT NULL DEFAULT '{}',
  likes_series TEXT NOT NULL DEFAULT '[]',
  best_comments TEXT NOT NULL DEFAULT '[]',
  fingerprint TEXT NOT NULL,
  winning_score REAL NOT NULL DEFAULT 0,
  momentum REAL NOT NULL DEFAULT 1,
  variant_count INTEGER NOT NULL DEFAULT 1,
  copy_count INTEGER NOT NULL DEFAULT 0,
  snapshot_url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_score ON radar_ads(winning_score DESC);
CREATE INDEX IF NOT EXISTS idx_radar_start ON radar_ads(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_radar_last_seen ON radar_ads(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_radar_advertiser ON radar_ads(advertiser);
CREATE INDEX IF NOT EXISTS idx_radar_domain ON radar_ads(landing_domain);
CREATE INDEX IF NOT EXISTS idx_radar_fp ON radar_ads(fingerprint);
CREATE INDEX IF NOT EXISTS idx_radar_country ON radar_ads(country, language);
CREATE INDEX IF NOT EXISTS idx_radar_network ON radar_ads(network);
CREATE INDEX IF NOT EXISTS idx_radar_active ON radar_ads(active, last_seen);

CREATE VIRTUAL TABLE IF NOT EXISTS radar_ads_fts USING fts5(
  body, headline, landing_title, advertiser, comments,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS radar_brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(name, domain)
);
CREATE TABLE IF NOT EXISTS radar_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  ad_id INTEGER,
  brand_id INTEGER,
  detail TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_radar_alerts ON radar_alerts(read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS radar_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a3f04b',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS radar_collection_items (
  collection_id INTEGER NOT NULL REFERENCES radar_collections(id) ON DELETE CASCADE,
  ad_id INTEGER NOT NULL REFERENCES radar_ads(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, ad_id)
);
CREATE TABLE IF NOT EXISTS radar_alert_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL REFERENCES radar_alerts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_alert_sends ON radar_alert_sends(channel, alert_id);
CREATE TABLE IF NOT EXISTS radar_sync_lock (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS radar_sync_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  ads INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_insights_source ON radar_sync_insights(source, created_at DESC);
CREATE TABLE IF NOT EXISTS radar_insight_ads (
  insight_id INTEGER NOT NULL REFERENCES radar_sync_insights(id) ON DELETE CASCADE,
  ad_id INTEGER NOT NULL REFERENCES radar_ads(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_id, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_radar_insight_ads_ad ON radar_insight_ads(ad_id);
CREATE TABLE IF NOT EXISTS radar_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  fetched INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  cursor TEXT,
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER
);
CREATE TABLE IF NOT EXISTS radar_saved (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS radar_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  calls INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS radar_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id INTEGER NOT NULL REFERENCES radar_ads(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES radar_collections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'local',
  simulated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_briefs_ad ON radar_briefs(ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_briefs_collection ON radar_briefs(collection_id);
CREATE TABLE IF NOT EXISTS radar_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES radar_briefs(id) ON DELETE CASCADE,
  ad_id INTEGER NOT NULL REFERENCES radar_ads(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES radar_collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  budget REAL NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 7,
  audience TEXT NOT NULL,
  checklist TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_campaigns_brief ON radar_campaigns(brief_id);
CREATE TABLE IF NOT EXISTS radar_lead_origins (
  lead_id INTEGER PRIMARY KEY,
  ad_id INTEGER NOT NULL,
  collection_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_lead_origins_collection ON radar_lead_origins(collection_id)
`;

let radarSchemaReady = false;

export async function radarDb(): Promise<AppDb> {
  const db = await getDb();
  if (radarSchemaReady) return db;
  await db.exec(RADAR_SCHEMA);
  const alertColumns = (await db.prepare('PRAGMA table_info(radar_alerts)').all()) as { name: string }[];
  if (!alertColumns.some((column) => column.name === 'source')) {
    await db.exec('ALTER TABLE radar_alerts ADD COLUMN source TEXT');
  }
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_radar_alerts_source ON radar_alerts(source, created_at DESC)').run();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM radar_ads').first() as { n: number } | null;
  if (!row || row.n === 0) {
    // seedRadar não adaptado para AppDb; banco permanece vazio no Workers (demo aceitável)
  }
  radarSchemaReady = true;
  return db;
}
