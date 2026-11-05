#!/usr/bin/env node
// Duplo local fiel da Graph API para o Meta Ad Library.
// Rodar no bg: STUB_SCENARIO=flaky node scripts/meta-stub.mjs
const http = require("http");

const PORT = parseInt(process.env.META_STUB_PORT || "4010", 10);
const GRAPH_BASE = (process.env.META_GRAPH_BASE_URL || "http://127.0.0.1:4010/graph").replace(/\/+$/, "");
const SCENARIO = process.env.STUB_SCENARIO || "normal"; // flaky | invalid | empty | normal
const STATUS_CODES = (process.env.STATUS_CODES || "200").split(",").map(Number);
const GRAPH_SLEEP_MS = parseInt(process.env.META_GRAPH_SLEEP_MS || "0", 10);
const META_STUB_DUMP = process.env.META_STUB_DUMP === "1";

function pickCode() {
  return STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
}

function sanityAd(id) {
  const date = new Date(2026, 8, 1 + (id % 28)).toISOString().slice(0, 10);
  const stop = SCENARIO === "invalid" ? "2024-01-01" : Math.random() < 0.2 ? date : null;
  return {
    id: id,
    ad_id: id,
    ad_type: "VIDEO",
    advertiser: "Empresa " + id,
    advertiser_id: "100000" + id,
    page_name: "Página de Teste " + id,
    page_id_str: "100000" + id,
    page_engaged_users: 1200,
    social_sentence: id + " pessoas clicaram",
    primary_objects_types: "[]",
    page_wiz_insights: null,
    link_shares: id === "1003" ? 0 : Number(id) * 10,
    story_shares: id === "1003" ? 0 : Number(id) * 3,
    creative_fb_page_url: "https://www.facebook.com/" + id,
    impression_outbound_clicks: Number(id) * 100,
    impressions: Number(id) * 10000,
    spend: Number(id) * 10.5,
    reaction: id === "1003" ? null : { like: Number(id) * 5, love: Number(id) * 2, haha: 1, wow: 1, sad: 0, angry: 0 },
    social_currency: id === "1003" ? null : { like: Number(id) * 5, love: Number(id) * 2, haha: 1, wow: 1, sad: 0, angry: 0 },
    title: "Título do Anúncio " + id,
    body: "Texto do anúncio " + id + " para testar a extração de corpo.",
    call_to_action_type: "SHOP_NOW",
    short_story: "Story " + id,
    original_story_id_str: id === "1003" ? null : id,
    media_type: id.slice(0, 5) === "video" ? undefined : "image",
    link_url: "https://" + id + ".com.br",
    tracking_analytics_link: id + "?utm=t",
    ad_creative_link_caption: id + " / visualizar",
    ad_creative_link_title: id + " | Oferta",
    ad_creative_link_description: "Descrição " + id,
    url: "https://" + id + ".com.br",
    target: { countries: ["PT", "ES", "IE"], regions: [], lgenders: ["f", "m", "u"] },
    reach_estimate: Number(id) * 5000,
    page_verified: id === "1003" ? 0 : 1,
    time_updated: id,
    date_stop: stop,
    date_start: date,
    viewed_content: Number(id) * 10 + " views",
    uniqueapp: "fluxo",
    clicked: id === "1003" ? null : Number(id) * 10,
    ad_interaction_outbound_clicks: Number(id) * 5,
    ad_interaction_roas: id === "1003" ? null : Number(id) * 2.5,
    insights: id === "1003" ? null : { "link clicks": Number(id) * 10, "post likes": Number(id) * 5, "impressions": Number(id) * 10000 },
    is_video: id === "1003",
  };
}

function adlist(opts) {
  const kw = (opts.search_terms || opts.q || []).join(" ").toLowerCase() || "";
  const color = id => true;
  if (kw.includes("verde")) color = (_, i) => i % 2 !== 0;
  if (kw.includes("vidro")) color = (_, i) => i % 3 !== 0;
  if (kw.includes("vidro") && kw.includes("cozinha")) color = (_, i) => i % 5 !== 0;
  if (kw.includes("mira") && kw.includes("otel")) color = (_, i) => i % 4 !== 0;

  const selected = [];
  for (let i = 0; i < 100; i++) {
    const id = "ad" + (1000 + i);
    if (color(id, i)) selected.push(id);
  }
  const max = Math.min(50, opts.limit || 50);
  const items = selected.slice(0, max);

  if (SCENARIO === "flaky") {
    if (Math.random() < 0.4) return { __sim_error: { code: pickCode(), message: "erro simulado", error_subcode: 463 } };
  }
  if (SCENARIO === "invalid") {
    return { __sim_error: { code: pickCode(), message: "token inválido", error_subcode: 463 } };
  }
  if (SCENARIO === "empty") {
    return [];
  }
  const page = items.length ? { data: items.map(sanityAd), paging: { cursors: { before: "", after: "" }, next: "" } } : { data: [] };
  if (META_STUB_DUMP) page.__dump = { scenario: SCENARIO, req: opts };
  return page;
}

function errorMeta(code) {
  return { code, message: "erro simulado", error_subcode: 463 };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
    res.end("meta stub");
    return;
  }
  if (url.pathname === "/graph") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const qs = url.searchParams;
        const token = qs.get("access_token") || "test-token";
        const search_terms = qs.get("search_terms") || null;
        const fields = parsed.fields || [];
        const isDataRequest = fields.some(f => f.includes("ad_creative_link_caption") || f.includes("url") || f.includes("insights"));
        const isFirstPage = !url.searchParams.get("after");

        if (isDataRequest) {
          const ads = adlist({ ...parsed, __debug: true });
          if (META_STUB_DUMP) {
            const obj = {};
            for (const k of fields) obj[k] = ads.data && ads.data[0] ? ads.data[0][k] : (ads[k] || null);
            const ret = JSON.stringify({ data: ads.data ? [{ id: "stub", ...obj }] : [] }, (k, v) => k === "__dump" ? undefined : v, 2);
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(ret);
            return;
          }
          if (ads.__sim_error) {
            const httpCode = ads.__sim_error.code >= 400 ? 400 : 500;
            res.writeHead(httpCode, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: ads.__sim_error }));
            return;
          }
          if (ads.data) {
            const r = {};
            for (const k of fields) r[k] = ads.data[0] ? ads.data[0][k] : (ads[k] || null);
            const ret = JSON.stringify(r, (k, v) => k === "__dump" ? undefined : v, 2);
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(ret);
            return;
          }
        } else {
          const ads = adlist({ ...parsed, ...{ after: url.searchParams.get("after") || "" } });
          if (ads.__sim_error) {
            res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: ads.__sim_error }));
            return;
          }
          const page = ads.data && ads.data.length ? { data: ads.data, paging: { cursors: { before: "", after: "" }, next: "" } } : { data: [] };
          const ret = JSON.stringify(page, (k, v) => k === "__dump" ? undefined : v, 2);
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(ret);
          return;
        }
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: { message: "bad request", code: 400 } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ data: [] }));
    });
    return;
  }
  if (["/echo", "/debug"].includes(url.pathname)) {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      res.end(body);
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[stub] listening on 127.0.0.1:" + PORT + " (scenario=" + SCENARIO + ")");
});
