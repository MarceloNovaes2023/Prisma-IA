import { BadgeCheck, Images, Link2, Play } from "lucide-react";
import { initialsOf } from "@/lib/radar/score";
import type { RadarAd } from "@/lib/radar/types";

const PALETTES = [
  { from: "#1d2a1a", to: "#3f5d2a", accent: "#a3f04b" },
  { from: "#1f1c33", to: "#3c3266", accent: "#b7a8ff" },
  { from: "#2b1a22", to: "#5c2f3f", accent: "#ff9db0" },
  { from: "#15262a", to: "#2c5b58", accent: "#8ce6dd" },
  { from: "#2a2417", to: "#5c4a24", accent: "#ffd489" },
  { from: "#161d29", to: "#2f3f57", accent: "#9fc3ef" },
];

function paletteOf(ad: RadarAd) {
  const seed = ad.advertiser.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + ad.id;
  return PALETTES[seed % PALETTES.length];
}

export function Creative({
  ad,
  size = "card",
  showAdvertiser = true,
}: {
  ad: RadarAd;
  size?: "card" | "detail";
  showAdvertiser?: boolean;
}) {
  const palette = paletteOf(ad);
  const detail = size === "detail";
  const mediaIcon =
    ad.media_type === "video" ? <Play size={11} /> : ad.media_type === "carousel" ? <Images size={11} /> : <Link2 size={11} />;

  return (
    <div
      className={`relative overflow-hidden ${detail ? "rounded-2xl" : "rounded-t-[13px]"}`}
      style={{
        background: `radial-gradient(120% 90% at 15% 0%, ${palette.accent}22 0%, transparent 55%), linear-gradient(150deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.35) 0%, transparent 45%), radial-gradient(circle at 10% 80%, rgba(255,255,255,0.18) 0%, transparent 40%)",
        }}
      />

      <div className={`relative flex flex-col ${detail ? "min-h-[430px] gap-5 p-7" : "min-h-[236px] gap-3 p-4"}`}>
        {showAdvertiser && (
          <div className="flex items-center gap-2">
            <span
              className={`grid shrink-0 place-items-center rounded-full font-semibold ${detail ? "size-8 text-[11px]" : "size-6 text-[9px]"}`}
              style={{ background: `${palette.accent}26`, color: palette.accent, boxShadow: `inset 0 0 0 1px ${palette.accent}55` }}
            >
              {initialsOf(ad.advertiser)}
            </span>
            <span className={`truncate font-medium text-white/90 ${detail ? "text-[13px]" : "text-[11px]"}`}>
              {ad.advertiser}
            </span>
            {ad.page_verified === 1 && <BadgeCheck size={detail ? 14 : 11} className="shrink-0 text-white/60" />}
          </div>
        )}

        <div className="flex-1">
          {ad.headline && (
            <p
              className={`font-semibold leading-[1.15] tracking-[-0.01em] text-white ${
                detail ? "text-[26px]" : "text-[15px]"
              } ${detail ? "" : "line-clamp-3"}`}
            >
              {ad.headline}
            </p>
          )}
          <p
            className={`mt-2 text-white/70 ${detail ? "text-[14px] leading-relaxed" : "text-[11px] leading-snug line-clamp-3"}`}
            style={{ whiteSpace: "pre-line" }}
          >
            {ad.body.length > (detail ? 520 : 132) ? `${ad.body.slice(0, detail ? 520 : 132)}…` : ad.body}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold ${
              detail ? "text-[12px]" : "text-[10px]"
            }`}
            style={{ background: palette.accent, color: "#0b1207" }}
          >
            {ad.cta ?? "Saiba mais"}
          </span>
          {ad.landing_domain && (
            <span className={`truncate text-white/45 ${detail ? "text-[11px]" : "text-[9.5px]"}`}>{ad.landing_domain}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider text-white/55">
            {mediaIcon}
            {ad.media_type}
          </span>
        </div>
      </div>

      <span className="absolute right-2 top-2 rounded bg-black/35 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-white/45">
        {ad.source === "sandbox" ? "demo" : ad.source}
      </span>
    </div>
  );
}
