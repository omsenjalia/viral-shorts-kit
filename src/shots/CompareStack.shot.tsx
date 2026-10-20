// CompareStack (type "compare"): the old way's pain points get struck off as they're named, then the new way's wins
// are dealt in one by one, each on its own spoken word.
// Port of shotcraft ui-entrance/card-stack (demos/ui-entrance/card-stack/CardStack.tsx), entrance half: each card
// springs up from below the frame (damping 13 / stiffness 150, one visible rebound), flies with an alternating ±9°
// tilt that settles on landing, gets a velocity-driven vertical motion blur (≤10px), and the whole group dips 5px
// (sin, 9f) as each one lands; deterministic ±1.2° / ±8px lie so the column reads hand-placed. The demo's ending
// (featured card pulled out + accent ring + one sheen) goes to the last win, with a small camera push onto it.
// The fan-out is dropped: on a phone the wins have to stay readable side by side, so they land in slots instead.
// The old way is a dark card that recedes up and back when the first win arrives; ivory win cards invert it
// (card-flip-reveal's dark → light). On Shorts a live tally (old ✕✕✕ / new ●●●) keeps the band below the subtitles moving.
//
// Data: { before: { label, items[] }, after: { label, items[], at? } }. Each item lands on the first of its words
// found in the narration (cue); unspoken items are spread between their neighbours.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ShotDef } from "./registry";
import type { SceneCtx } from "../types";
import { Dust, LOOKS, Sheen, Stage, alpha, springAt, type } from "../sc/Look";
import { EASE, FONT, mix, ramp, softShadow } from "../sc/Polish";
import { Sfx } from "../lib/fx";

const L = LOOKS.agentmode;
const IVORY = "#FAF9F5";
const INK = "#141413";

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Frame each item lands: the first of its words that is spoken, else spread between the known neighbours.
const schedule = (items: string[], cue: SceneCtx["cue"], lo: number, hi: number, min: number) => {
  const raw = items.map((it) => {
    for (const w of it.split(/\s+/)) {
      const f = cue(w, -1);
      if (f >= 0) return f;
    }
    return -1;
  });
  const out = raw.map((f, i) => {
    if (f >= 0) return f;
    let a = i - 1;
    while (a >= 0 && raw[a] < 0) a--;
    let b = i + 1;
    while (b < raw.length && raw[b] < 0) b++;
    const fa = a >= 0 ? raw[a] : lo;
    const fb = b < raw.length ? raw[b] : hi;
    return Math.round(mix(fa, fb, (i - a) / (b - a)));
  });
  // keep order and a minimum spacing so two cues never collide
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], min, i ? out[i - 1] + 8 : 0);
  return out;
};

export const CompareStack: React.FC<SceneCtx<string>> = ({ scene, dur, S, vertical: V, cue }) => {
  const f = useCurrentFrame();
  const before: { label?: string; items?: string[] } = scene.before ?? {};
  const after: { label?: string; items?: string[]; at?: string } = scene.after ?? {};
  const bItems = (before.items ?? []).slice(0, 4);
  const aItems = (after.items ?? []).slice(0, 4);

  // ---- timing ----
  const afterAt = cue(after.at ?? aItems[0]?.split(/\s+/)[0], Math.round(dur * 0.45));
  const strikes = schedule(bItems, cue, 6, afterAt - 4, 8);
  const lands = schedule(aItems, cue, afterAt, Math.round(dur * 0.85), 0).map((x, i) => (i === 0 ? Math.min(x, afterAt) : x));
  const firstLand = lands[0] ?? dur;
  const T2 = Math.max((strikes[strikes.length - 1] ?? 0) + 8, firstLand - 14); // the old card recedes
  const START = lands.map((x) => Math.max(T2 + 2, x - 6)); // spring crosses its mark ≈6f after take-off
  const last = aItems.length - 1;
  const lastLand = last >= 0 ? START[last] + 6 : dur;

  // ---- layout (design space 1080×1920 / 1920×1080) ----
  const W0 = V ? 1080 : 1920;
  const H0 = V ? 1920 : 1080;
  const BW = V ? 900 : 700;
  const rowH = V ? 116 : 104;
  const BH = (V ? 120 : 110) + bItems.length * rowH + 30;
  const bA = V ? { cx: 540, cy: 690, s: 1 } : { cx: 960, cy: 470, s: 1.25 };
  const bB = V ? { cx: 540, cy: 230 + (BH * 0.6) / 2 + 10, s: 0.6 } : { cx: 500, cy: 490, s: 0.9 };
  const recede = ramp(f, T2, 16, EASE.smooth);
  const bPos = { cx: mix(bA.cx, bB.cx, recede), cy: mix(bA.cy, bB.cy, recede), s: mix(bA.s, bB.s, recede) };
  const AW = V ? 900 : 820;
  const AH = V ? 150 : 160;
  const AX = V ? 90 : 950;
  const slotTop = V ? Math.max(bB.cy + (BH * bB.s) / 2 + 74, 600) : 250;
  const gap = V ? 18 : 20;
  const slotY = aItems.map((_, i) => slotTop + i * (AH + gap));
  const labelY = slotTop - (V ? 70 : 60);

  // ---- card-stack entrance physics ----
  const DROP = V ? 1150 : 820;
  const inAt = (fr: number, i: number) => (fr < START[i] ? 0 : springAt(fr, START[i], { damping: 13, stiffness: 150 }));
  const dip = START.reduce((d, s) => d + Math.sin(clamp01((f - s - 6) / 9) * Math.PI) * 5, 0);
  const pull = last >= 0 ? ramp(f, lastLand + 4, 18, EASE.overshoot) : 0;
  const ring = last >= 0 ? ramp(f, lastLand + 6, 12, EASE.out) : 0;
  const sheen = last >= 0 ? ramp(f, lastLand + 10, 22, EASE.smooth) : 0;

  // ---- camera: slow creep, a nudge per landed win, then a small push onto the last one ----
  const landed = START.filter((s) => f >= s + 6).length;
  const nudge = START.reduce((z, s) => z + 0.012 * ramp(f, s + 4, 14, EASE.out), 0);
  const zoom = mix(1, 1.025, ramp(f, 0, dur, EASE.smooth)) + nudge + 0.05 * ramp(f, lastLand + 2, 26, EASE.smooth);
  const lastCy = last >= 0 ? slotY[last] + AH / 2 : H0 / 2;
  const lastCx = AX + AW / 2;
  const focus = { x: mix(W0 / 2, lastCx, 0.5 * pull), y: mix(V ? 690 : 480, lastCy, 0.5 * pull) };
  // the push would lift the receded old card into the watermark: hold its screen top at y ≥ 232 by sliding the camera down
  const bTop = bPos.cy - (BH * bPos.s) / 2;
  const camDrop = V ? Math.max(0, 232 - (focus.y + (bTop - focus.y) * zoom)) : 0;

  const struckN = strikes.filter((s) => f >= s).length;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {strikes.map((s, i) => (
        <Sfx key={`s${i}`} at={s} name="switch" volume={0.3} />
      ))}
      {START.map((s, i) => (
        <Sfx key={`a${i}`} at={s + 5} name="pop" volume={0.35} />
      ))}
      {last >= 0 && <Sfx at={lastLand + 6} name="bell" volume={0.25} />}
      <div style={{ position: "absolute", left: 0, top: 0, width: W0, height: H0, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden" }}>
        <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={{ x: 0.5, y: 1.0 }} intensity={0.85} breathe={0.5} vignette={0.45}>
          {[0, ...(V ? [1] : [])].map((i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 960, height: 1080 }}>
              <Dust look={L} count={V ? 20 : 30} seed={11 + i} drift={0.25} opacity={0.4} color={L.accent2} />
            </div>
          ))}
        </Stage>

        <AbsoluteFill style={{ transform: `translateY(${camDrop.toFixed(2)}px) scale(${zoom.toFixed(4)})`, transformOrigin: `${focus.x.toFixed(1)}px ${focus.y.toFixed(1)}px` }}>
          <AbsoluteFill style={{ perspective: 1800 }}>
            {/* the old way: dark card, items struck off as they're named; recedes up and back when the first win comes */}
            <div
              style={{
                position: "absolute", left: bPos.cx - BW / 2, top: bPos.cy - BH / 2, width: BW, height: BH, borderRadius: 26,
                background: L.surface, border: `1px solid ${L.line}`, boxSizing: "border-box",
                boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.06)}, ${softShadow(mix(14, 4, recede), { color: "#000000", strength: 1.3 })}`,
                transform: `translateY(${((1 - ramp(f, 0, 14, EASE.snappy)) * 90).toFixed(2)}px) rotateX(${((1 - ramp(f, 0, 16, EASE.snappy)) * 16 + 7 * recede).toFixed(2)}deg) scale(${bPos.s.toFixed(4)})`,
                transformOrigin: "50% 50%",
                opacity: mix(1, 0.72, recede),
                padding: V ? "40px 56px" : "36px 48px",
              }}
            >
              <div style={{ ...type(V ? 30 : 26, 650, { caps: true }), fontFamily: FONT.mono, letterSpacing: "0.16em", color: L.ink3, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: L.ink3, flex: "none" }} />
                {before.label ?? "The old way"}
              </div>
              <div style={{ marginTop: V ? 30 : 24 }}>
                {bItems.map((it, i) => {
                  const p = ramp(f, strikes[i], 9, EASE.snappy);
                  const show = ramp(f, 2 + i * 3, 12, EASE.out);
                  return (
                    <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: V ? 28 : 24, opacity: show, transform: `translateY(${((1 - show) * 18).toFixed(1)}px)` }}>
                      <div style={{ width: V ? 46 : 40, height: V ? 46 : 40, borderRadius: 12, flex: "none", border: `3px solid ${p > 0 ? L.accent : alpha(L.ink, 0.25)}`, boxSizing: "border-box", position: "relative" }}>
                        <svg viewBox="0 0 40 40" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                          <path d="M12 12 L28 28 M28 12 L12 28" stroke={L.accent} strokeWidth={4.5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={`${p} 1`} />
                        </svg>
                      </div>
                      <span style={{ position: "relative", ...type(V ? 60 : 50, 600), color: p > 0.5 ? L.ink3 : L.ink, whiteSpace: "nowrap" }}>
                        {it}
                        <span style={{ position: "absolute", left: -6, right: -6, top: "54%", height: V ? 6 : 5, borderRadius: 3, background: L.accent, transform: `scaleX(${p.toFixed(4)})`, transformOrigin: "0 50%", boxShadow: `0 0 12px ${alpha(L.accent, 0.5 * p)}` }} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* the new way: label, then ivory win cards dealt in from below, each on its word */}
            {aItems.length > 0 && (
              <div style={{ position: "absolute", left: AX + 4, top: labelY, ...type(V ? 34 : 28, 700, { caps: true }), letterSpacing: "0.16em", color: L.accent, display: "flex", alignItems: "center", gap: 14, opacity: ramp(f, T2 + 12, 10, EASE.out), transform: `translateY(${((1 - ramp(f, T2 + 12, 14, EASE.snappy)) * 16).toFixed(1)}px)` }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: L.accent, boxShadow: `0 0 14px ${alpha(L.accent, 0.8)}`, flex: "none" }} />
                {after.label ?? "The new way"}
              </div>
            )}
            {aItems.map((it, i) => {
              if (f < START[i]) return null;
              const p = inAt(f, i);
              // the spring's rebound is kept, but scaled to card size: a full-DROP overshoot would hop over the label
              const y = p <= 1 ? (1 - p) * DROP : (1 - p) * AH * 0.8;
              const vy = (1 - inAt(f + 0.5, i) - (1 - inAt(f - 0.5, i))) * DROP;
              const blurY = Math.min(10, Math.abs(vy) * 0.18);
              const tilt = (i % 2 ? 1 : -1) * 9 * (y / DROP);
              const lie = (rand(i * 3 + 1) - 0.5) * 2.4;
              const lieX = (rand(i * 5 + 2) - 0.5) * 16;
              const hero = i === last;
              const lift = hero ? pull : 0;
              const elev = 6 + (y / DROP) * 50 + 22 * lift;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute", left: AX, top: slotY[i], width: AW, height: AH,
                    transform: `translate3d(${lieX.toFixed(2)}px, ${(y + dip - 10 * lift).toFixed(2)}px, ${(i * 2 + 40 * lift).toFixed(1)}px) rotateX(${(18 * (y / DROP)).toFixed(2)}deg) rotate(${(lie * (1 - lift) + tilt).toFixed(3)}deg) scale(${(1 + 0.035 * lift).toFixed(4)})`,
                    transformOrigin: "50% 130%",
                    zIndex: 10 + i,
                  }}
                >
                  {blurY > 0.4 && (
                    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
                      <filter id={`cmp-vb-${i}`} x="-10%" y="-40%" width="120%" height="180%">
                        <feGaussianBlur stdDeviation={`0 ${blurY.toFixed(2)}`} />
                      </filter>
                    </svg>
                  )}
                  <div
                    style={{
                      position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", background: IVORY, boxSizing: "border-box",
                      boxShadow: `inset 0 1px 0 #ffffff, ${softShadow(elev, { color: "#000000", strength: 1.4 })}` + (hero && ring > 0 ? `, 0 0 0 ${(4 * ring).toFixed(2)}px ${alpha(L.accent, 0.95 * ring)}, 0 0 ${(40 * ring).toFixed(1)}px ${alpha(L.accent, 0.45 * ring)}` : ""),
                      filter: blurY > 0.4 ? `url(#cmp-vb-${i})` : undefined,
                      display: "flex", alignItems: "center", gap: V ? 30 : 26, padding: V ? "0 44px" : "0 40px",
                    }}
                  >
                    <div style={{ width: V ? 70 : 62, height: V ? 70 : 62, borderRadius: 18, background: L.accent, flex: "none", display: "grid", placeItems: "center" }}>
                      <svg viewBox="0 0 40 40" width="62%" height="62%">
                        <path d="M9 21 L17 29 L31 12" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray={`${ramp(f, START[i] + 6, 10, EASE.out)} 1`} />
                      </svg>
                    </div>
                    <div style={{ ...type(V ? 56 : 48, 750), color: INK, whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>{it}</div>
                    {hero && <Sheen progress={sheen} strength={0.6} width={0.18} />}
                  </div>
                </div>
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>

        {/* Shorts: a live tally under the subtitles (old ✕ per strike, new ● per landed win) */}
        {V && (
          <div style={{ position: "absolute", left: 90, width: 840, top: 1500, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: ramp(f, 4, 12, EASE.out) }}>
            <Tally label="Old" n={bItems.length} on={struckN} at={strikes} f={f} mark="x" />
            <div style={{ flex: 1, height: 2, margin: "0 34px", background: `linear-gradient(90deg, ${alpha(L.ink, 0.12)}, ${alpha(L.accent, 0.12 + 0.5 * (landed / Math.max(1, aItems.length)))})` }} />
            <Tally label="New" n={aItems.length} on={landed} at={START.map((s) => s + 6)} f={f} mark="dot" />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Tally: React.FC<{ label: string; n: number; on: number; at: number[]; f: number; mark: "x" | "dot" }> = ({ label, n, at, f, mark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <span style={{ fontFamily: FONT.mono, fontSize: 34, letterSpacing: "0.16em", color: mark === "x" ? L.ink3 : L.accent, textTransform: "uppercase", marginRight: 6 }}>{label}</span>
    {Array.from({ length: n }, (_, i) => {
      const p = ramp(f, at[i] ?? 1e9, 10, EASE.overshoot);
      return (
        <div key={i} style={{ width: 54, height: 54, borderRadius: mark === "x" ? 14 : 27, border: `3px solid ${mark === "x" ? alpha(L.ink, 0.22) : alpha(L.accent, 0.5)}`, boxSizing: "border-box", display: "grid", placeItems: "center", transform: `scale(${(1 + 0.25 * Math.sin(clamp01((f - (at[i] ?? 1e9)) / 8) * Math.PI)).toFixed(3)})` }}>
          {mark === "x" ? (
            <svg viewBox="0 0 40 40" width="70%" height="70%">
              <path d="M12 12 L28 28 M28 12 L12 28" stroke={L.accent} strokeWidth={5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={`${clamp01(p)} 1`} />
            </svg>
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: 15, background: L.accent, transform: `scale(${Math.max(0, p).toFixed(3)})`, boxShadow: `0 0 14px ${alpha(L.accent, 0.7)}` }} />
          )}
        </div>
      );
    })}
  </div>
);

export const shot: ShotDef = { type: "compare", component: CompareStack, ground: "ink", fullBleed: true };
