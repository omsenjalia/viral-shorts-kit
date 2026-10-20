import { AbsoluteFill, Img } from "remotion";
import { BRAND } from "../brand-template/brand";
import { Mascot } from "../brand-template/Mascot";
import type { EpisodeProps } from "./Episode";

const C = BRAND.colors;

// 1280x720 custom thumbnail from the hook: one big claim, Mo reacting, brand chip.
export const Thumbnail: React.FC<EpisodeProps & { text?: string }> = ({ scenes, text }) => {
  const hook = scenes?.find((s) => s.type === "hook");
  const line: string = text ?? (hook && "text" in hook ? String(hook.text) : "");
  const accent = (hook && "accent" in hook && hook.accent ? hook.accent : "").toLowerCase().split(" ");
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: BRAND.fonts.heading }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 78% 55%, ${C.clay}33, transparent 70%)` }} />
      <div style={{ position: "absolute", left: 70, top: 60, right: 470, bottom: 60, display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1.02, color: C.ivory, letterSpacing: "-0.02em" }}>
          {line.split(" ").map((w, i) => (
            <span key={i} style={{ color: accent.includes(w.toLowerCase().replace(/[^\w]/g, "")) ? C.clay : C.ivory }}>
              {w}{" "}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", right: 50, bottom: 20 }}>
        {/* negative delay: a Still only has frame 0, so skip the pop-in */}
        <Mascot size={400} mood="shock" enterDelay={-60} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 40, display: "flex", alignItems: "center", gap: 12, fontFamily: BRAND.fonts.body, fontWeight: 700, fontSize: 30, color: C.oat }}>
        <Img src={BRAND.logo} style={{ width: 46, borderRadius: 10 }} />
        {BRAND.name}
      </div>
    </AbsoluteFill>
  );
};
