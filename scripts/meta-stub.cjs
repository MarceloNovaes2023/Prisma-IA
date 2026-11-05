#!/usr/bin/env node
// Duplo local fiel da Graph API para o Meta Ad Library.
// Rodar no bg: STUB_SCENARIO=flaky node scripts/meta-stub.cjs
// Cenários: normal | flaky | invalid | empty
const http = require('http');

const PORT = parseInt(process.env.META_STUB_PORT || '4010', 10);
const SCENARIO = process.env.STUB_SCENARIO || 'normal'; // flaky | invalid | empty | normal
const STATUS_CODES = (process.env.STATUS_CODES || '200').split(',').map(Number);
const META_STUB_DUMP = process.env.META_STUB_DUMP === '1';

function pickCode() { return STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)]; }

function sanityAd(id) {
  // FIXED dates - no dynamic Date construction to avoid 'Invalid time value'.
  const FIXED_START = '2026-08-01T00:00:00Z';
  const FIXED_STOP = '2026-12-31T00:00:00Z';
  const d = '2026-08-17'; // fixed valid date
  return {
    id: id,
    ad_id: id,
    ad_type: 'VIDEO',
    advertiser: 'Empresa ' + id,
    advertiser_id: '100000' + id,
    page_name: 'Página de Teste ' + id,
    page_id_str: '100000' + id,
    page_engaged_users: 1200,
    social_sentence: id + ' pessoas clicaram',
    primary_objects_types: '[]',
    page_wiz_insights: null,
    link_shares: id === '1003' ? 0 : Number(id) * 10,
    story_shares: id === '1003' ? 0 : Number(id) * 3,
    creative_fb_page_url: 'https://www.facebook.com/' + id,
    impression_outbound_clicks: Number(id) * 100,
    impressions: Number(id) * 10000,
    spend: Number(id) * 10.5,
    reaction: id === '1003' ? null : { like: Number(id) * 5, love: Number(id) * 2, haha: 1, wow: 1, sad: 0, angry: 0 },
    social_currency: id === '1003' ? null : { like: Number(id) * 5, love: Number(id) * 2, haha: 1, wow: 1, sad: 0, angry: 0 },
    title: 'Título do Anúncio ' + id,
    body: 'Texto do anúncio ' + id + ' para testar a extração de corpo.',
    call_to_action_type: 'SHOP_NOW',
    headline: 'Cabeçalho do anúncio ' + id,
    description: 'Descrição do anúncio ' + id,
    landing_url: 'https://stub.example.com.br/' + id,
    landing_domain: id === '1003' ? null : 'stub.example.com.br',
    path: id === '1003' ? null : '/oferta-' + id,
    image_url: 'https://stub.example.com.br/images/' + id + '.jpg',
    image_captions: ['https://stub.example.com.br/legenda-' + id],
    video_length: 15,
    video_url: 'https://stub.example.com.br/video/' + id + '.mp4',
    video_playable_sec: 10,
    ad_delivery_start_time: FIXED_START,
    ad_delivery_stop_time: FIXED_STOP,
    languages: ['pt'],
    publisher_platforms: ['FACEBOOK'],
    media_type: 'image',
    snapshot_url: 'https://www.facebook.com/ad/stub/snap',
    page_verified: 0,
    ad_snapshot_url: 'https://www.facebook.com/ad/stub/snap',
    ad_reached_countries: ['BR'],
    ad_reached_platforms: ['FACEBOOK'],
    region: 'São Paulo',
    region_id_str: '1010101',
    match_type: 'EXACT',
    ad_format: 'STANDARD',
    action_type: 'LINK_CLICKS'
  };
}

function adlist(opts) {
  const scenario = opts.scenario || SCENARIO || 'normal';
  if (scenario === 'empty') {
    return [];
  }
  if (scenario === 'flaky') {
    if (Math.random() < 0.4) {
      return { __sim_error: { code: 17, message: 'token inválido', error_subcode: 463 } };
    }
  }
  if (scenario === 'invalid') {
    return { __sim_error: { code: 17, message: 'token inválido', error_subcode: 463 } };
  }
  const kw = (opts.search_terms || opts.q || []).join(' ').toLowerCase() || '';
  const color = (id) => true;
  if (kw.includes('verde')) color = (_, i) => i % 2 !== 0;
  if (kw.includes('vidro')) color = (_, i) => i % 3 !== 0;
  if (kw.includes('vidro') && kw.includes('cozinha')) color = (_, i) => i % 5 !== 0;
  if (kw.includes('mira') && kw.includes('otel')) color = (_, i) => i % 4 !== 0;
  const selected = [];
  for (let i = 0; i < 100; i++) {
    const id = 'ad' + (1000 + i);
    if (color(id, i)) selected.push(id);
  }
  const max = Math.min(50, opts.limit || 50);
  const items = selected.slice(0, max);
  const page = items.length
    ? { data: items.map(sanityAd), paging: { cursors: { before: '', after: '' }, next: '' } }
    : { data: [] };
  if (META_STUB_DUMP) page.__dump = { scenario: SCENARIO, req: opts };
  return page;
}

function describeError(error, status) {
  if (error?.code === 17 && error?.error_subcode === 463) return 'Token da Graph API inválido.';
  return 'Graph API respondeu HTTP ' + status + '.';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }); res.end('meta stub'); return;
  }
  const graph = /^\/graph\/v[0-9]+\.[0-9]+\/ads_archive$/;
  const bare = /^\/v[0-9]+\.[0-9]+\/ads_archive$/;
  if (req.method === 'GET' && (graph.test(url.pathname) || bare.test(url.pathname))) {
    const stripped = url.pathname.replace(/\//g, '');
    const version = stripped.match(/v([0-9]+)\.([0-9]+)ads_archive$/)[1];
    const qs = url.searchParams;
    const scenario = qs.get('STUB_SCENARIO') || process.env.STUB_SCENARIO || 'normal';
    const params = {
      access_token: qs.get('access_token') || 'test-token',
      ad_reached_countries: qs.get('ad_reached_countries') || 'BR',
      limit: qs.get('limit') || '10'
    };
    const body = adlist({ ...params, search_terms: null, scenario });
    let ret = JSON.stringify(body, (k, v) => (k === '__sim_error' || k === '__dump') ? undefined : v, 2);
    if (body.__sim_error) {
      const code = body.__sim_error.code || pickCode();
      if (code === 17) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        ret = JSON.stringify({ error: { message: body.__sim_error.message, code, error_subcode: body.__sim_error.error_subcode, type: 'OAuthException' } }, null, 2);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    }
    res.end(ret); return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => { console.log('[stub] listening on 127.0.0.1:' + PORT + ' (scenario=' + SCENARIO + ')'); });
