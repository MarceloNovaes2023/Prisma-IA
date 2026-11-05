import { NextResponse, type NextRequest } from "next/server";
import { runSyncLeased } from "@/lib/radar/sync-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim() ?? process.env.RADAR_API_KEY?.trim();
  if (!secret) return true;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  return header === secret || query === secret;
}

async function handle(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const source = params.get("fonte") ?? "sandbox";
  const outcome = await runSyncLeased(source, {
    searchTerms: params.get("q") ?? undefined,
    countries: params.get("paises") ?? undefined,
    pages: Number(params.get("paginas") ?? 0) || undefined,
  });

  if (outcome.busy) {
    const retryAfter = outcome.minutesLeft * 60;
    return NextResponse.json(
      {
        error: "sync_busy",
        message: outcome.message,
        holder: outcome.holder,
        retryAfterSeconds: retryAfter,
      },
      {
        status: 409,
        headers: { "cache-control": "no-store", "retry-after": String(retryAfter) },
      },
    );
  }

  const { result, dispatched } = outcome;

  const status = result.status === "ok" ? 200 : result.status === "skipped" ? 200 : 502;
  return NextResponse.json(
    { ...result, alerts: dispatched.map(({ channel, sent, ok, message }) => ({ channel, sent, ok, message })) },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
