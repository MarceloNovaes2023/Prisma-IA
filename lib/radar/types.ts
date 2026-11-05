export type RadarAd = {
  id: number;
  external_id: string;
  source: string;
  advertiser: string;
  advertiser_id: string | null;
  page_verified: number;
  network: string;
  start_date: string;
  stop_date: string | null;
  first_seen: string;
  last_seen: string;
  active: number;
  country: string;
  language: string;
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  media_type: string;
  cta: string | null;
  headline: string | null;
  body: string;
  description: string | null;
  landing_url: string | null;
  landing_domain: string | null;
  landing_title: string | null;
  redirect_chain: string | null;
  tech_stack: string | null;
  offer_id: string | null;
  affiliate_network: string | null;
  likes: number;
  comments: number;
  shares: number;
  reactions: string;
  likes_series: string;
  best_comments: string;
  fingerprint: string;
  winning_score: number;
  momentum: number;
  variant_count: number;
  copy_count: number;
  snapshot_url: string | null;
};

export type ReactionSet = { like: number; love: number; haha: number; wow: number; sad: number; angry: number };

export type RadarFilters = {
  q?: string;
  campo?: string;
  rede?: string;
  origem?: string;
  pais?: string;
  idioma?: string;
  genero?: string;
  idade?: string;
  desde?: string;
  ate?: string;
  visto?: string;
  durMin?: string;
  curMin?: string;
  curMax?: string;
  comMin?: string;
  compMin?: string;
  cta?: string;
  midia?: string;
  dominio?: string;
  marca?: string;
  tech?: string;
  oferta?: string;
  ordem?: string;
  pagina?: string;
  colecao?: string;
};

export type AdRow = RadarAd & { collection_at?: string | null; has_insight?: number };

export type SearchResult = {
  rows: AdRow[];
  total: number;
  page: number;
  pages: number;
  tookMs: number;
};

export type TrackedBrand = {
  id: number;
  name: string;
  domain: string | null;
  note: string | null;
  created_at: string;
  ads: number;
  active: number;
  avg_score: number;
  last_new: string | null;
};

export type RadarAlert = {
  id: number;
  kind: string;
  ad_id: number | null;
  brand_id: number | null;
  detail: string;
  created_at: string;
  read_at: string | null;
};

export type Collection = {
  id: number;
  name: string;
  color: string;
  created_at: string;
  items: number;
};

export type SourceStatus = {
  source: string;
  label: string;
  mode: "live" | "sandbox" | "import";
  coverage: string;
  detail: string;
  configured: boolean;
  last: {
    status: string;
    fetched: number;
    inserted: number;
    updated: number;
    message: string | null;
    finished_at: string | null;
    duration_ms: number | null;
  } | null;
};
