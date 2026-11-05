import Link from "next/link";
import { Clock3, Copy, Heart, MessageCircle, Share2, Sparkles, Tag } from "lucide-react";
import { Creative } from "./creative";
import { Badge, Score } from "@/components/ui";
import { compact, daysRunning, scoreTone } from "@/lib/radar/score";
import type { AdRow } from "@/lib/radar/types";

export function AdCard({ ad, collectionId }: { ad: AdRow; collectionId?: string }) {
  const days = daysRunning(ad);
  const tone = scoreTone(ad.winning_score);

  return (
    <Link
      href={`/radar/anuncio/${ad.id}${collectionId ? `?colecao=${collectionId}` : ""}${ad.has_insight ? "#analise-ia" : ""}`}
      className="card group flex flex-col overflow-hidden transition-colors hover:border-[#2f3f4f]"
    >
      <Creative ad={ad} />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="truncate text-[11.5px] font-medium">{ad.advertiser}</span>
          <span className="ml-auto shrink-0">
            <Score value={Math.round(ad.winning_score)} />
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge tone={ad.active === 1 ? "lime" : "cold"} dot>
            {ad.active === 1 ? "no ar" : "encerrado"}
          </Badge>
          {ad.copy_count > 0 && (
            <Badge tone="rose">
              <Copy size={9} /> {ad.copy_count} cópia{ad.copy_count > 1 ? "s" : ""}
            </Badge>
          )}
          {ad.has_insight ? (
            <Badge tone="violet">
              <Sparkles size={9} /> análise IA
            </Badge>
          ) : null}
          {ad.offer_id && (
            <Badge tone="violet">
              <Tag size={9} /> {ad.affiliate_network ?? ad.offer_id}
            </Badge>
          )}
        </div>

        <p className="line-clamp-2 text-[11px] leading-snug text-muted">{ad.body}</p>

        <div className="mt-auto flex items-center gap-3 border-t border-line-soft pt-2 text-[10.5px] tabular-nums text-dim">
          <span className="inline-flex items-center gap-1">
            <Heart size={10} /> {compact(ad.likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={10} /> {compact(ad.comments)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 size={10} /> {compact(ad.shares)}
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1"
            style={{ color: tone === "hot" ? "#c8ff7d" : tone === "warm" ? "#ffd489" : undefined }}
          >
            <Clock3 size={10} /> {days} d
          </span>
        </div>
      </div>
    </Link>
  );
}
