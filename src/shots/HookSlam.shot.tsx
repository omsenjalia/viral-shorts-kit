// HookSlam (type "hook"): the 3-6 word claim, readable from frame 0 (the thumbnail), lands on the voice. Ports two shotcraft cards:
// - typography/lead-word-zoom-assemble: the line pivots on the lead word's centre + baseline and breathes in (+6% push,
//   then recede on the card's ZOOM_EASE); each word gets the card's push-in kick (WORD_EASE) when it is spoken.
//   Review fix: the card's "lead word alone, rest assembles later" opening left frame 0 reading only "AI", so the
//   whole line is composed from frame 0 and only the emphasis waits for the voice.
// - effects/slam-entrance-moves B (score-slam): the accent word waits as a clay outline, then its solid twin hovers in front
//   of the lens and slams onto it on ease-in quad, firing the impact kit (ring + shards + sparks + shake + flash): the
//   episode's one full-frame slam (R4).
// Mo fills the lower band (vertical y ~1440-1780, clear of the subtitle band; the slam recoil is a lean, not a hop), talks with the voice and is knocked back by the slam.
// Dropped on purpose: the card's closing crash (Episode's cut is the exit).
import React, { Fragment, useEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Mascot } from "../../brand-template/Mascot";
import { BRAND } from "../../brand-template/brand";
import { LOOKS, Stage, alpha, springAt } from "../sc/Look";
import { EASE, bezier, mix, ramp } from "../sc/Polish";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";

const L = LOOKS.agentmode;
const GLINT = "#FFE3CF";

// ---- lead-word-zoom-assemble (card values) ----
const PUSH_SCALE = 1.06;
const HOLD = 12;
const RECEDE = 12;
const WORD_DURATION = 12;
const WORD_PUSH = 0.5; // em
const PUSH_EASE = bezier(0.25, 1, 0.5, 1);
const ZOOM_EASE = bezier(0.5, 0, 0.05, 1);
const WORD_EASE = bezier(0.22, 0.8, 0.36, 1);

// ---- score-slam (card values) ----
const HOVER = 9;
const DROP = 6;
const EASE_IN_QUAD = bezier(0.55, 0.085, 0.68, 0.53);

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const ang = (i / 14) * Math.PI * 2 + (rnd(i + 3) - 0.5) * 0.5;
  return {
    ang, dist: 280 + rnd(i + 11) * 300, size: 22 + rnd(i + 23) * 26, spin: (rnd(i + 31) - 0.5) * 620, warm: i % 3 === 0,
    poly: [0, 1, 2, 3].map((k) => `${(50 + Math.cos(k * 1.7 + i) * (30 + rnd(i * 4 + k) * 20)).toFixed(0)}% ${(50 + Math.sin(k * 1.7 + i) * (30 + rnd(i * 5 + k) * 20)).toFixed(0)}%`).join(", "),
  };
});
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  ang: (i / 16) * Math.PI * 2 + (rnd(i + 61) - 0.5) * 0.4, dist: 360 + rnd(i + 71) * 320, len: 40 + rnd(i + 81) * 50,
}));

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A shotcraft sound (public/sfx/sc, Mixkit, see public/sfx/LICENSE.md) whose frame `hot` lands on `at`. */
const ScSfx: React.FC<{ at: number; file: string; hot?: number; volume: number }> = ({ at, file, hot = 0, volume }) => {
  const from = Math.round(at - hot);
  return (
    <Sequence from={Math.max(0, from)} layout="none">
      <Audio src={staticFile(`sfx/sc/${file}`)} volume={volume} trimBefore={from < 0 ? -from : undefined} />
    </Sequence>
  );
};

type Box = { x: number; y: number; w: number; h: number };

const Claim: React.FC<SceneCtx<"hook"> & { text: string }> = ({ scene, dur, S, vertical, cue, text }) => {
  const f = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  const acc = new Set(String(scene.accent ?? "").split(/\s+/).map(norm).filter(Boolean));
  const accIdx = words.findIndex((w, i) => i > 0 && acc.has(norm(w)));
  const slamIdx = accIdx > 0 ? accIdx : words.length > 1 ? words.length - 1 : -1;
  const longest = Math.max(...words.map((w) => w.length));
  const colW = (vertical ? 920 : 1060) * S;
  const fs = Math.min((vertical ? (words.length <= 4 ? 200 : words.length <= 6 ? 190 : 180) : words.length <= 4 ? 190 : words.length <= 6 ? 172 : 160) * S, colW / (longest * 0.6));

  // ---- timing: each word's beat on its spoken word; a word the voice never says (or rewords) follows its neighbour ----
  const heard = (w: string) => {
    const a = cue(w, -999);
    return a !== -999 ? a : cue(norm(w).replace(/s$/, ""), -999);
  };
  const at: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const h = heard(words[i]);
    at.push(i === 0 ? (h === -999 ? 0 : h) : Math.max(at[i - 1] + 3, h === -999 ? at[i - 1] + 6 : h));
  }
  const tS = slamIdx > 0 ? at[slamIdx] : Infinity;

  // ---- measure once (card: pivot = lead-word centre x + baseline y, read with a zero-size ruler) ----
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const blockRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() => delayRender("HookSlam: measure claim"));
  const [m, setM] = useState<{ boxes: Box[]; baseline: number; height: number } | null>(null);
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      setM({
        boxes: wordRefs.current.map((el) => (el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 })),
        baseline: rulerRef.current?.offsetTop ?? fs * 0.8,
        height: blockRef.current?.offsetHeight ?? fs * 3,
      });
    });
    return () => {
      alive = false;
    };
  }, [fs]);
  useEffect(() => {
    if (m) continueRender(handle);
  }, [m, handle]);

  const boxes = m?.boxes ?? words.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const bh = m?.height ?? fs * 3;
  const bx = (vertical ? 80 : 160) * S;
  const by = vertical ? 300 * S : 470 * S - bh / 2;
  const lead = boxes[0] ?? { x: 0, y: 0, w: 0, h: 0 };
  const ox = lead.x + lead.w / 2;
  const oy = m?.baseline ?? fs * 0.8;
  // the line breathes in from frame 0 around the lead word's pivot (card: hold push, then recede on one curve)
  const scale = 1 + (PUSH_SCALE - 1) * (ramp(f, 0, HOLD, PUSH_EASE) - ramp(f, HOLD, RECEDE, ZOOM_EASE));

  // ---- score-slam on the accent word ----
  const hover = ramp(f, tS - DROP - HOVER, HOVER, EASE.smooth);
  const drop = ramp(f, tS - DROP, DROP, EASE_IN_QUAD);
  const settle = springAt(f, tS, { damping: 14, stiffness: 260 });
  const slamScale = f < tS ? mix(mix(2.75, 2.6, hover), 0.965, drop) : mix(0.965, 1, settle);
  const slamOp = ramp(f, tS - DROP - HOVER, 6, EASE.out) * mix(0.6, 1, drop);
  const slamDof = Math.min(1, Math.max(0, (slamScale - 1) / 1.75)) * 10;
  const slamRot = mix(5, 0, drop);
  const slamDy = f < tS ? mix(-40 - 30 * hover, 0, drop) * S : 0;
  const sweep = ramp(f, tS + 6, 16, EASE.swift); // glint through the accent once it has landed

  // impact kit, centred on the accent word's resting place
  const sb = slamIdx > 0 ? boxes[slamIdx] : lead;
  const CX = bx + sb.x + sb.w / 2;
  const CY = by + sb.y + sb.h / 2;
  let shakeX = 0;
  let shakeY = 0;
  if (f >= tS && f < tS + 5) {
    const t = f - tS;
    const amp = 18 * S * Math.exp(-t * 0.85);
    shakeX = amp * 0.4 * (rnd(f * 7 + 1) * 2 - 1);
    shakeY = amp * (t === 0 ? 1 : rnd(f * 13 + 2) * 2 - 1);
  }
  const flash = f >= tS && f < tS + 3 ? [0.22, 0.12, 0.04][f - tS] : 0;
  const ringT = ramp(f, tS, 16, EASE.snappy);
  const ringLin = ramp(f, tS, 16, EASE.linear);
  const ringOn = f >= tS && f < tS + 16;
  const ringD = mix(120, 1500, ringT) * S;
  const ringOp = ringLin < 0.6 ? mix(1, 0.65, ringLin / 0.6) : mix(0.65, 0, (ringLin - 0.6) / 0.4);
  const shT = ramp(f, tS, 20, EASE.out);
  const shLin = ramp(f, tS, 20, EASE.linear);
  const spT = ramp(f, tS, 10, bezier(0.1, 0.9, 0.2, 1));
  const spLin = ramp(f, tS, 10, EASE.linear);
  const push = 1 + 0.02 * ramp(f, Math.min(tS, dur), 120, EASE.swift);

  // ---- Mo: big in the lower band, talks with the voice, leans in on the hover, gets knocked back by the slam ----
  const moSize = (vertical ? 280 : 460) * S;
  const moTop = vertical ? 1446 * S : 250 * S; // antenna below the subtitle band even at the bob's peak (y > 1430)
  const moLeft = vertical ? 540 * S - moSize / 2 : 1390 * S;
  const ms = (f / 30) * 1000;
  const talking = f < tS && scene.captions.some((c) => c.startMs <= ms && ms < c.endMs);
  const kt = f - tS;
  const kick = kt >= 0 ? Math.exp(-kt / 6) * Math.sin(Math.min(Math.PI, kt / 2.4) + 0.4) : 0;
  const lean = 4 * hover * (1 - drop);

  const accentFill: React.CSSProperties = {
    fontStyle: "italic",
    color: "transparent",
    backgroundImage: `linear-gradient(100deg, ${L.accent} 0%, ${L.accent} 40%, ${GLINT} 50%, ${L.accent} 60%, ${L.accent} 100%)`,
    backgroundSize: "300% 100%",
    backgroundPosition: `${(1 - sweep) * 100}% 0`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    paddingRight: "0.08em", // italic overhang stays inside the clip
    marginRight: "-0.08em",
  };
  // card's push-in, replayed as a kick on the spoken word: pushed up into its slot (WORD_EASE). Vertical only, plus a
  // 4% scale on its own baseline: a sideways push or a bigger scale ate the word gaps ("YourAI", review v5)
  const kickStyle = (i: number): React.CSSProperties => {
    const p = f < at[i] ? 1 : ramp(f, at[i], WORD_DURATION, WORD_EASE);
    return { translate: `0 ${((1 - p) * 0.4 * WORD_PUSH * fs).toFixed(2)}px`, scale: `${(1 + (1 - p) * 0.04).toFixed(4)}`, transformOrigin: "50% 85%" };
  };
  const slamLayer: React.CSSProperties = {
    ...accentFill,
    position: "absolute", left: 0, top: 0,
    opacity: slamOp,
    transform: `translateY(${slamDy.toFixed(2)}px) rotate(${slamRot.toFixed(3)}deg) scale(${slamScale.toFixed(4)})`,
    filter: slamDof > 0.4 ? `blur(${slamDof.toFixed(2)}px)` : undefined,
  };
  // before its word the accent waits as a dim clay ghost (frame 0 stays a full, readable claim; a text-stroke outline
  // draws the glyphs' inner overlaps, the text-as-mask card's pitfall)
  const ghost: React.CSSProperties = {
    ...accentFill, backgroundImage: "none", color: L.accent, opacity: 0.38 * (1 - ramp(f, tS, 3, EASE.linear)),
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Stage look={L} keyLight={{ x: vertical ? 0.5 : 0.4, y: vertical ? 0.28 : 0.38 }} fill={{ x: 0.85, y: 0.9 }} intensity={0.9} breathe={0.5} />

      <div style={{ position: "absolute", inset: -40 * S, transform: `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(2)}px)` }}>
        <div style={{ position: "absolute", inset: 40 * S, transform: `scale(${push.toFixed(5)})` }}>
          {ringOn && (
            <>
              <div style={{ position: "absolute", left: CX - ringD / 2, top: CY - ringD / 2, width: ringD, height: ringD, borderRadius: "50%", opacity: ringOp, boxShadow: `0 0 ${(30 + ringT * 40) * S}px ${(6 + ringT * 8) * S}px ${alpha(L.accent, 0.45)}, inset 0 0 ${(30 + ringT * 40) * S}px ${alpha(L.accent, 0.3)}` }} />
              <div style={{ position: "absolute", left: CX - ringD / 2, top: CY - ringD / 2, width: ringD, height: ringD, borderRadius: "50%", opacity: ringOp, border: `${mix(9, 1.5, ringT) * S}px solid ${alpha("#fffaf0", 0.95)}`, boxSizing: "border-box" }} />
            </>
          )}
          {f >= tS && f < tS + 10 &&
            SPARKS.map((s, i) => {
              const r = (160 + s.dist * spT) * S;
              const len = (s.len * (1 - spLin) + 6) * S;
              return (
                <div key={i} style={{ position: "absolute", left: CX + Math.cos(s.ang) * r - len / 2, top: CY + Math.sin(s.ang) * r * 0.8 - 2 * S, width: len, height: 4 * S, borderRadius: 2 * S, background: `linear-gradient(90deg, ${alpha(GLINT, 0)}, #fffaf0)`, transform: `rotate(${((s.ang * 180) / Math.PI).toFixed(1)}deg)`, opacity: 1 - spLin, boxShadow: `0 0 ${10 * S}px ${alpha(L.accent, 0.9)}` }} />
              );
            })}

          {/* the claim: composed from frame 0, pivot on the lead word's centre + baseline */}
          <div
            ref={blockRef}
            style={{
              position: "absolute", left: bx, top: by, width: colW,
              fontFamily: BRAND.fonts.display, fontWeight: 800, fontSize: fs, lineHeight: 0.98, letterSpacing: "-0.035em", color: L.ink,
              transformOrigin: `${ox}px ${oy}px`,
              scale: `${scale.toFixed(5)}`,
              opacity: m ? 1 : 0,
              textShadow: `0 ${6 * S}px ${30 * S}px ${alpha("#000", 0.35)}`,
            }}
          >
            {words.map((w, i) => {
              const isAcc = acc.has(norm(w));
              return (
                <Fragment key={i}>
                  {i === slamIdx ? (
                    <span ref={(el) => { wordRefs.current[i] = el; }} style={{ display: "inline-block", position: "relative" }}>
                      <span style={{ display: "inline-block", ...(isAcc ? ghost : { opacity: 0.38 * (1 - ramp(f, tS, 3, EASE.linear)) }) }}>{w}</span>
                      <span style={{ display: "inline-block", ...(isAcc ? slamLayer : { ...slamLayer, backgroundImage: "none", color: L.ink, fontStyle: "normal" }) }}>{w}</span>
                    </span>
                  ) : (
                    <span ref={(el) => { wordRefs.current[i] = el; }} style={{ display: "inline-block", ...(isAcc ? accentFill : null), ...kickStyle(i) }}>
                      {w}
                    </span>
                  )}
                  {i === 0 && <span ref={rulerRef} style={{ display: "inline-block", width: 0, height: 0 }} />}
                  {/* the space sits outside the inline-block, or the line box eats it (card pitfall) */}
                  {i < words.length - 1 ? " " : null}
                </Fragment>
              );
            })}
          </div>

          <div style={{ position: "absolute", left: moLeft, top: moTop, transformOrigin: "50% 100%", transform: `translateY(${(vertical ? 0 : -kick * 46 * S).toFixed(2)}px) rotate(${(lean - kick * 9).toFixed(2)}deg) scaleY(${(1 - Math.max(0, -kick) * 0.1).toFixed(3)})` }}>
            <Mascot size={moSize} mood={scene.mood ?? "shock"} talking={talking} enterDelay={-60} />
          </div>

          {f >= tS && f < tS + 20 &&
            SHARDS.map((d, i) => {
              const sx = Math.cos(d.ang) * d.dist * shT * S;
              const sy = (Math.sin(d.ang) * d.dist * 0.75 * shT + 260 * shLin * shLin) * S;
              const s = d.size * (1 - 0.55 * shLin) * S;
              const flip = Math.abs(Math.cos(shLin * Math.PI * 1.6 + i));
              return (
                <div key={i} style={{ position: "absolute", left: CX + Math.cos(d.ang) * 300 * S + sx - s / 2, top: CY + Math.sin(d.ang) * 120 * S + sy - s / 2, width: s, height: s, clipPath: `polygon(${d.poly})`, background: d.warm ? `linear-gradient(135deg, ${BRAND.colors.clayDark}, ${L.accent} 45%, ${GLINT} 55%, ${BRAND.colors.clayDark})` : `linear-gradient(135deg, ${alpha("#ffffff", 0.9)}, ${alpha(L.ink2, 0.55)})`, opacity: shLin < 0.7 ? 1 : 1 - (shLin - 0.7) / 0.3, transform: `rotate(${(d.spin * shT).toFixed(1)}deg) scaleY(${Math.max(0.15, flip).toFixed(3)})`, filter: i % 4 === 0 ? `blur(${2 * S}px)` : undefined }} />
              );
            })}
        </div>
      </div>

      {flash > 0 && <AbsoluteFill style={{ background: "#fffaf0", opacity: flash, mixBlendMode: "screen" }} />}

      {/* riser -> impact (sound-design 4.3): the whoosh peaks (file frame 21) and the bass hit (onset 2) on the slam */}
      {Number.isFinite(tS) && <ScSfx at={tS} file="whoosh-fast.mp3" hot={21} volume={0.45} />}
      {Number.isFinite(tS) && <ScSfx at={tS} file="bass-hit-short.mp3" hot={2} volume={0.8} />}
    </AbsoluteFill>
  );
};

const HookSlam: React.FC<SceneCtx<"hook">> = (ctx) => {
  const text = String(ctx.scene.text ?? "").trim() || "Big AI news.";
  // remount on new copy/format so the one-time measurement is redone (Studio prop edits)
  return <Claim key={`${text}|${ctx.vertical}|${ctx.S}`} {...ctx} text={text} />;
};

export const shot: ShotDef = { type: "hook", component: HookSlam, ground: "ink", fullBleed: true };
