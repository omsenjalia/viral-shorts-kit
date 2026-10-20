// OutroLockup (type "cta"): the end card. Port of shotcraft outro/logo-shrink-wordmark-lockup's lockup grammar:
// the logo stamps in (ease-in drop + the card's 6% brake overshoot + one thin shockwave), "Agent Mode" slides in letter
// by letter with a focus blur, and the line under it fades in whole. Then a FOLLOW pill lands and Mo rises waving.
// Review fix: the card's opening neon ring read as a loading spinner, so it is cut. The lockup lands by ~0.3 s and
// everything has settled by ~1 s, leaving a ~2.5 s poster (R1: the brand mark holds well past 1 s).
// Mo is the 3D Mo (Mo3D.shot.tsx, used as-is) so the end card doesn't downgrade from the 3D Mo shot before it.
// Not ported: ui-to-brand-morph (needs a recurring UI element to morph) and brand-frame-snap (a chapter wrapper).
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BRAND } from "../../brand-template/brand";
import { Sfx } from "../lib/fx";
import { LOOKS, Stage, alpha, springAt } from "../sc/Look";
import { EASE, FONT, bezier, mix, ramp } from "../sc/Polish";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";
import { shot as mo3d } from "./Mo3D.shot"; // read-only: the 3D Mo shot, mounted whole and re-framed below

const L = LOOKS.agentmode;
const C = BRAND.colors;
const EASE_IN_QUAD = bezier(0.55, 0.085, 0.68, 0.53);
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const LAND = 6; // the logo hits on this frame
const WORD = "Agent Mode";

const ScSfx: React.FC<{ at: number; file: string; hot?: number; volume: number }> = ({ at, file, hot = 0, volume }) => {
  const from = Math.round(at - hot);
  return (
    <Sequence from={Math.max(0, from)} layout="none">
      <Audio src={staticFile(`sfx/sc/${file}`)} volume={volume} trimBefore={from < 0 ? -from : undefined} />
    </Sequence>
  );
};

const OutroLockup: React.FC<SceneCtx<"cta">> = (ctx) => {
  const { scene, S, vertical } = ctx;
  const f = useCurrentFrame();
  const follow = String(scene.text ?? "").trim() || "Follow Agent Mode";
  const sub = String(scene.sub ?? "").trim();

  const ICON = 140 * S;
  const u = ICON / 30; // the card's design unit (its icon was 30px)
  const cx = (vertical ? 540 : 760) * S;
  const cy = (vertical ? 500 : 380) * S;

  // logo stamp: drop from 1.9x on ease-in quad, then the card's brake overshoot (+6%, sin envelope)
  const drop = ramp(f, 0, LAND, EASE_IN_QUAD);
  const brake = Math.sin(ramp(f, LAND, 5, EASE.linear) * Math.PI) * 0.06;
  const logoScale = mix(1.9, 1, drop) * (1 + brake);
  const logoBlur = (1 - drop) * 8 * S;
  const logoOp = mix(0.5, 1, ramp(f, 0, 3, EASE.linear)); // the cut never lands on an empty frame
  const wave = ramp(f, LAND, 16, outCubic);
  const haloA = mix(0.55, 0.3, ramp(f, LAND, 20, outCubic)) * logoOp;

  const stagger = 0.9;
  const tag = ramp(f, 16, 8, EASE.out);
  const pill = springAt(f, 20, { damping: 14, stiffness: 200 });
  const sheen = ramp(f, 42, 16, EASE.swift);
  // Mo3D frames Mo itself (no text: centre (W/2, 640) 820 px tall vertical, (W/2, 450) 690 px wide); re-frame its whole
  // layer with one transform: vertical below the FOLLOW pill (Mo3D's camera push grows him to y ~910-1745 by the end), wide to the right of the lockup
  const MO_IN = 14; // Mo3D's landing + wave (its frames 8-92) start here, so he is still waving on the poster
  const k = vertical ? 1 : 0.81; // vertical: full width, so its stage has no side seams
  const tx = (vertical ? 540 - 540 * k : 1600 - 960 * k) * S;
  const ty = (vertical ? 1380 - 640 * k : 560 - 450 * k) * S;
  const moMask = vertical
    ? "linear-gradient(to bottom, transparent 0%, #000 9%)" // its opaque stage fades into ours above Mo's antenna
    : "radial-gradient(ellipse 34% 52% at 50% 44%, #000 65%, transparent 100%)";
  const moScene = { ...scene, text: "", accent: "", pose: "wave", mood: "happy", captions: scene.captions.map((c) => ({ ...c, startMs: c.startMs - (MO_IN * 1000) / 30, endMs: c.endMs - (MO_IN * 1000) / 30 })) };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Stage look={L} keyLight={{ x: cx / ((vertical ? 1080 : 1920) * S), y: vertical ? 0.3 : 0.38 }} fill={{ x: 0.5, y: 0.95 }} intensity={0.8} />
      <Sequence from={MO_IN} layout="none">
        <div style={{ position: "absolute", left: 0, top: 0, width: (vertical ? 1080 : 1920) * S, height: (vertical ? 1920 : 1080) * S, transformOrigin: "0 0", transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k})`, WebkitMaskImage: moMask, maskImage: moMask }}>
          <mo3d.component {...ctx} scene={moScene as never} />
        </div>
      </Sequence>
      <div style={{ position: "absolute", left: cx - 480 * S, top: cy - 300 * S, width: 960 * S, height: 600 * S, borderRadius: "50%", opacity: haloA, background: `radial-gradient(closest-side, ${alpha(C.clay, 0.35)}, ${alpha(C.clay, 0)})` }} />

      {/* lockup row: logo + wordmark, centred on cx */}
      <div style={{ position: "absolute", left: 0, right: vertical ? 0 : undefined, width: vertical ? undefined : cx * 2, top: cy - ICON / 2, height: ICON, display: "flex", justifyContent: "center", alignItems: "center", gap: 40 * S }}>
        <div style={{ position: "relative", width: ICON, height: ICON, flex: "none" }}>
          {wave > 0 && wave < 1 && (
            <div style={{ position: "absolute", left: ICON / 2 - mix(16, 80, wave) * u, top: ICON / 2 - mix(16, 80, wave) * u, width: mix(32, 160, wave) * u, height: mix(32, 160, wave) * u, borderRadius: "50%", boxSizing: "border-box", border: `${mix(0.9, 0.25, wave) * u}px solid ${alpha(C.ivory, 0.6 * (1 - wave))}`, boxShadow: `0 0 ${mix(4, 10, wave) * u}px ${alpha(C.clay, 0.55 * (1 - wave))}` }} />
          )}
          {/* the logo's own field is ink, so an ivory rim + clay glow keep it reading on the ink stage */}
          <div style={{ position: "absolute", inset: 0, borderRadius: ICON * (112 / 512), overflow: "hidden", opacity: logoOp, transform: `scale(${logoScale.toFixed(4)})`, filter: logoBlur > 0.3 ? `blur(${logoBlur.toFixed(2)}px)` : undefined, boxShadow: `0 0 0 ${3 * S}px ${alpha(C.ivory, 0.9)}, 0 ${10 * S}px ${50 * S}px ${alpha(C.clay, 0.5)}` }}>
            <Img src={BRAND.logo} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
        </div>
        <div style={{ display: "flex", whiteSpace: "pre" }}>
          {[...WORD].map((ch, i) => {
            const lk = ramp(f, 4 + i * stagger, 7, outCubic);
            return (
              <span key={i} style={{ color: i >= 6 ? C.clay : C.ivory, fontFamily: BRAND.fonts.heading, fontWeight: 700, fontSize: 118 * S, lineHeight: 1, letterSpacing: "-0.01em", opacity: lk, transform: `translateX(${mix(8, 0, lk) * u}px)`, filter: lk < 0.999 ? `blur(${mix(2.5, 0, lk) * u * 0.5}px)` : undefined }}>
                {ch}
              </span>
            );
          })}
        </div>
      </div>

      {/* the line under the wordmark: whole line at once (card: a footnote, not the hero) */}
      {sub && (
        <div style={{ position: "absolute", left: vertical ? 60 * S : 0, width: vertical ? 960 * S : cx * 2, top: cy + ICON / 2 + 44 * S, textAlign: "center", color: L.accent2, fontFamily: FONT.sans, fontWeight: 700, fontSize: 40 * S, letterSpacing: "0.16em", textTransform: "uppercase", opacity: tag, transform: `translateY(${mix(3, 0, tag) * u}px)` }}>
          {sub}
        </div>
      )}

      {/* the action: a clay FOLLOW pill that springs in, one glint across it */}
      <div style={{ position: "absolute", left: 0, width: vertical ? 1080 * S : cx * 2, top: cy + ICON / 2 + (sub ? 140 : 80) * S, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 22 * S, padding: `${26 * S}px ${54 * S}px`, borderRadius: 999, background: C.clay, color: C.ink, fontFamily: FONT.sans, fontWeight: 800, fontSize: 50 * S, letterSpacing: "0.02em", textTransform: "uppercase", opacity: ramp(f, 20, 3, EASE.linear), transform: `scale(${mix(0.6, 1, pill).toFixed(4)})`, boxShadow: `0 ${14 * S}px ${40 * S}px ${alpha("#000", 0.45)}, 0 0 ${40 * S}px ${alpha(C.clay, 0.35)}` }}>
          <span style={{ fontWeight: 900, fontSize: 60 * S, lineHeight: 1, marginTop: -4 * S }}>+</span>
          {follow}
          <div style={{ position: "absolute", top: 0, bottom: 0, width: "30%", left: `${mix(-40, 120, sheen)}%`, background: `linear-gradient(100deg, ${alpha(C.ivory, 0)}, ${alpha(C.ivory, 0.45)}, ${alpha(C.ivory, 0)})`, transform: "skewX(-18deg)" }} />
        </div>
      </div>

      {/* riser -> impact on the stamp, sparkle on the line, a pop for the pill (sound-design 4.3) */}
      <ScSfx at={LAND} file="whoosh-fast.mp3" hot={21} volume={0.3} />
      <ScSfx at={LAND} file="impact-deep-whoosh.mp3" hot={10} volume={0.55} />
      {sub && <ScSfx at={16} file="sparkle-touch.mp3" hot={13} volume={0.35} />}
      <Sfx at={20} name="pop" volume={0.4} />
    </AbsoluteFill>
  );
};

export const shot: ShotDef = { type: "cta", component: OutroLockup, ground: "ink", fullBleed: true };
