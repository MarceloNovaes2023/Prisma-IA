import { NextResponse, type NextRequest } from "next/server";
import { searchAds } from "@/lib/radar/search";
import type { RadarFilters } from "@/lib/radar/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.RADAR_API_KEY?.trim();
  if (expected) {
    const provided = request.headers.get("x-api-key") ?? request.nextUrl.searchParams.get("key");
    if (provided !== expected) {
      return NextResponse.json({ error: "unauthorized", hint: "envie o header x-api-key" }, { status: 401 });
    }
  }

  const params = request.nextUrl.searchParams;
  const value = (key: string) => params.get(key) ?? undefined;

  const filters: RadarFilters = {
    q: value("q"),
    campo: value("campo"),
    rede: value("rede"),
    origem: value("origem"),
    pais: value("pais"),
    idioma: value("idioma"),
    genero: value("genero"),
    idade: value("idade"),
    desde: value("desde"),
    ate: value("ate"),
    visto: value("visto"),
    durMin: value("durMin"),
    curMin: value("curMin"),
    curMax: value("curMax"),
    comMin: value("comMin"),
    compMin: value("compMin"),
    cta: value("cta"),
    midia: value("midia"),
    dominio: value("dominio"),
    marca: value("marca"),
    tech: value("tech"),
    oferta: value("oferta"),
    ordem: value("ordem"),
    pagina: value("pagina"),
    colecao: value("colecao"),
  };

  try {
    const result = searchAds(filters);
    return NextResponse.json(
      {
        total: result.total,
        page: result.page,
        pages: result.pages,
        tookMs: Number(result.tookMs.toFixed(2)),
        ads: result.rows.map((ad) => ({
          id: ad.id,
          externalId: ad.external_id,
          source: ad.source,
          advertiser: ad.advertiser,
          network: ad.network,
          active: ad.active === 1,
          startDate: ad.start_date,
          stopDate: ad.stop_date,
          lastSeen: ad.last_seen,
          country: ad.country,
          language: ad.language,
          mediaType: ad.media_type,
          cta: ad.cta,
          headline: ad.headline,
          body: ad.body,
          landingUrl: ad.landing_url,
          landingDomain: ad.landing_domain,
          offerId: ad.offer_id,
          affiliateNetwork: ad.affiliate_network,
          engagement: { likes: ad.likes, comments: ad.comments, shares: ad.shares },
          winningScore: Math.round(ad.winning_score),
          momentum: ad.momentum,
          variants: ad.variant_count,
          copies: ad.copy_count,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "search_failed", message: error instanceof Error ? error.message : "erro desconhecido" },
      { status: 500 },
    );
  }
}
