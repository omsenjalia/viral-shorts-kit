// chat: port of shotcraft typography/document-typewriter-reveal
// (demos/ui-entrance/document-typewriter-reveal/DocumentTypewriterReveal.tsx, Apache-2.0).
// Kept from the demo: a floating app window (rounded, hairline edge, backlight in page space, long shadow) shot by a
// 3D window camera (layout-level CSS zoom + rotY/rotX, monotone cubic Hermite through keyframes, no velocity jumps)
// that opens on an oblique close-up and pulls back to the full window; text written behind ONE accent caret riding
// the reveal front; the idle caret blinks for 8f before writing starts; the last block grows an accent wash after
// it lands (the demo's @-mention highlight); a 0.8% creep on the hold.
// Agent Mode: the close-up is the composer while the prompt types big (macro), "send" lifts it into a bubble while
// the camera pulls back, then the reply streams in block by block. LOOKS.agentpaper, FONT.sans, 9:16 + 16:9 layouts.
import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE, FONT, mix, ramp } from "../sc/Polish";
import { LOOKS, Stage, alpha } from "../sc/Look";
import { Sfx } from "../lib/fx";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";

const L = LOOKS.agentpaper;
const PAPER = "#FFFFFF";
const CARET = L.accent;
const PERSP = 2200;
const REVEAL_EASE = Easing.bezier(0.4, 0, 0.6, 1);

// macro/end zooms are capped so the window (incl. its perspective growth) stays inside the content zone at every
// frame: 9:16 y 230–1150 (under the watermark and above the subtitles), 16:9 y ~140–860. The close-up reads from
// the prompt's size (56 px page → ~60 px on screen) rather than from cropping the window.
type Lay = { FW: number; FH: number; SX: number; SY: number; W: number; H: number; macro: number; end: number; fs: { prompt: number; bubble: number; reply: number } };
const VERT: Lay = { FW: 1080, FH: 1920, SX: 540, SY: 690, W: 940, H: 820, macro: 1.06, end: 0.95, fs: { prompt: 56, bubble: 38, reply: 44 } };
const WIDE: Lay = { FW: 1920, FH: 1080, SX: 960, SY: 490, W: 1240, H: 640, macro: 1.06, end: 0.95, fs: { prompt: 46, bubble: 36, reply: 40 } };

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ───────────── camera (the demo's Hermite rig) ─────────────
type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number };
type Key = Cam & { frame: number };
const PARAMS: (keyof Cam)[] = ["cx", "cy", "zoom", "rotX", "rotY"];
const hermite = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => (i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};
const camAt = (keys: Key[], f: number): Cam =>
  Object.fromEntries(PARAMS.map((p) => [p, hermite(keys.map((k) => k.frame), keys.map((k) => k[p]))(f)])) as Cam;

// ───────────── timing ─────────────
const charTimes = (s: string, k: number) => {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    out.push(t);
    t += (0.75 + rand(31 + i) * 0.9 + (s[i] === " " ? 0.6 : 0)) * k;
  }
  return { out, end: t };
};
const TYPE0 = 8; // idle caret blinks for 8f first (demo)
const PULL = 30; // send → full window

const plan = (prompt: string, blocks: string[], dur: number) => {
  let best = null as null | { typing: ReturnType<typeof charTimes>; send: number; reply: number; cues: number[]; wipes: number[]; end: number };
  for (const k of [1.1, 0.95, 0.8, 0.68, 0.56, 0.48]) {
    const typing = charTimes(prompt, k);
    const send = Math.round(TYPE0 + typing.end + 6);
    const reply = send + 22;
    const wipes = blocks.map((b) => Math.min(30, Math.max(9, b.length * 0.6 * Math.min(1, k + 0.1))));
    const cues: number[] = [];
    let t = reply;
    wipes.forEach((w) => { cues.push(t); t += w + 4; });
    best = { typing, send, reply, cues, wipes, end: t };
    if (t + 18 <= dur) break;
  }
  return best!;
};

const Caret: React.FC<{ h: number; opacity?: number }> = ({ h, opacity = 1 }) => (
  <span style={{
    display: "inline-block", width: 3, height: h, marginLeft: 3, verticalAlign: "-0.18em", borderRadius: 2, background: CARET, opacity,
    boxShadow: `0 0 8px ${alpha(CARET, 0.6)}, 0 0 20px ${alpha(L.accent, 0.4)}`,
  }} />
);

// optional `artifact: { name, at }`: the reply's output file pops out of the window into the lower band on its cue
// (9:16: y 1440–1640, x < 960, clear of the subtitles and YouTube's buttons; 16:9: over the window's lower-right corner)
// 9:16 only: from the first frames a ghost of the tile's slot holds the lower band (dashed outline, filmstrip
// outline, a progress track that fills from send to the cue), so the frame is never bottom-empty; the tile lands in it.
const GhostSlot: React.FC<{ at: number; send: number; f: number }> = ({ at, send, f }) => {
  const out = ramp(f, at + 2, 8, EASE.out);
  if (out >= 1) return null;
  const h = 200, tw = h * 1.15, th = h - 40;
  const fill = ramp(f, send, Math.max(1, at - send), EASE.linear);
  return (
    <div style={{
      position: "absolute", left: 80, top: 1440, width: 740, height: h, boxSizing: "border-box", borderRadius: 30,
      border: `3px dashed ${alpha(L.ink, 0.16)}`, display: "flex", alignItems: "center", gap: h * 0.14, padding: "0 40px 0 17px",
      opacity: ramp(f, 4, 12, EASE.out) * (1 - out),
    }}>
      <div style={{ width: tw, height: th, flex: "none", borderRadius: 14, border: `3px solid ${alpha(L.ink, 0.12)}`, boxSizing: "border-box" }} />
      <div style={{ flex: 1, height: 14, borderRadius: 7, background: alpha(L.ink, 0.08), overflow: "hidden" }}>
        <div style={{ width: `${fill * 100}%`, height: "100%", borderRadius: 7, background: L.accent }} />
      </div>
    </div>
  );
};

const ArtifactTile: React.FC<{ name: string; at: number; f: number; vertical: boolean }> = ({ name, at, f, vertical }) => {
  if (f < at) return null;
  const h = vertical ? 200 : 160;
  const p = ramp(f, at, 18, EASE.overshoot);
  const air = 1 - ramp(f, at, 14, EASE.out);
  const [dx, dy] = vertical ? [0, -380] : [-260, -170];
  const tw = h * 1.15, th = h - 40;
  return (
    <div style={{
      position: "absolute", ...(vertical ? { left: 80, top: 1440, width: 740 } : { left: 1300, top: 620, width: 560 }), height: h,
      display: "flex", alignItems: "center", gap: h * 0.14, padding: `0 ${h * 0.2}px 0 20px`, boxSizing: "border-box", borderRadius: 30,
      background: PAPER, boxShadow: `0 0 0 1.5px ${alpha(L.ink, 0.07)}, 0 ${30 + 40 * air}px ${60 + 50 * air}px -20px ${alpha(L.shadow, 0.4)}, inset 0 2px 0 #fff`,
      opacity: ramp(f, at, 3, EASE.linear), transformOrigin: "30% 50%",
      transform: `translate(${(dx * (1 - p)).toFixed(1)}px, ${(dy * (1 - p)).toFixed(1)}px) scale(${mix(0.55, 1, p).toFixed(4)})`,
    }}>
      {/* filmstrip thumbnail: sprocket rows + a clay frame with a play mark */}
      <div style={{ position: "relative", width: tw, height: th, flex: "none", borderRadius: 14, overflow: "hidden", background: "#141413" }}>
        {[0, 1].map((r) => (
          <div key={r} style={{ position: "absolute", left: 8, right: 8, [r ? "bottom" : "top"]: 7, display: "flex", justifyContent: "space-between" }}>
            {Array.from({ length: 8 }, (_, k) => <div key={k} style={{ width: tw / 16, height: th * 0.08, borderRadius: 2, background: alpha("#FAF9F5", 0.55) }} />)}
          </div>
        ))}
        <div style={{
          position: "absolute", left: 8, right: 8, top: th * 0.2, bottom: th * 0.2, borderRadius: 6,
          background: `linear-gradient(135deg, #E08463, ${L.accent} 55%, #8f3f24)`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 0, height: 0, marginLeft: th * 0.06, borderTop: `${th * 0.14}px solid transparent`, borderBottom: `${th * 0.14}px solid transparent`, borderLeft: `${th * 0.22}px solid #FAF9F5` }} />
        </div>
      </div>
      <div style={{ fontSize: vertical ? 46 : 38, fontWeight: 750, letterSpacing: "-0.02em", color: L.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name} <span style={{ color: L.accent }}>▶</span>
      </div>
    </div>
  );
};

const ChatPrompt: React.FC<SceneCtx<"chat">> = ({ scene, dur, S, vertical, cue }) => {
  const f = useCurrentFrame();
  const lay = vertical ? VERT : WIDE;
  const { W, H } = lay;
  const app = scene.app || "Claude";
  const prompt = scene.prompt || "Make me a launch video";
  const blocks = (scene.reply || "On it.").split(/(?<=[.!?…])\s+/).filter(Boolean);
  const p = plan(prompt, blocks, dur);

  // composer geometry (page px) — rows estimated from Inter Tight's ~0.5em average advance
  const compPad = 28, btn = vertical ? 76 : 72;
  const textW = W - compPad * 2 - 60 - btn - 16;
  const rows = Math.max(1, Math.ceil((prompt.length * 0.5 * lay.fs.prompt) / textW));
  const compH = Math.max(112, 52 + rows * lay.fs.prompt * 1.3);

  const send = p.send;
  const keys: Key[] = [
    { frame: 0, cx: W * 0.5, cy: H / 2, zoom: lay.macro * 1.015, rotX: 5, rotY: -11 },
    { frame: send, cx: W * 0.5, cy: H / 2, zoom: lay.macro, rotX: 4, rotY: -8 },
    { frame: send + PULL, cx: W / 2, cy: H / 2, zoom: lay.end, rotX: 2, rotY: -3 },
    { frame: Math.max(send + PULL + 1, dur), cx: W / 2, cy: H / 2, zoom: lay.end * 1.008, rotX: 2, rotY: -2 },
  ];
  const cam = camAt(keys, f);

  // prompt typing
  const n = p.typing.out.filter((x) => x <= f - TYPE0).length;
  const sent = f >= send;
  const idleBlink = f < TYPE0 ? (Math.floor(f / 4) % 2 === 0 ? 1 : 0.25) : 1;
  const press = 1 - 0.12 * Math.sin(Math.PI * clamp01((f - send + 1) / 7));
  const ready = n >= prompt.length && !sent;
  // bubble lifts out of the composer as the camera pulls back
  const lift = ramp(f, send, 16, EASE.snappy);
  const thinking = f >= send + 8 && f < p.reply;

  // reply stream: one caret, on the newest block still writing
  let caretIdx = -1;
  blocks.forEach((_, i) => { if (f >= p.cues[i] && f <= p.cues[i] + p.wipes[i] + 2) caretIdx = i; });
  const lastI = blocks.length - 1;
  const washAt = p.cues[lastI] + p.wipes[lastI] + 4;
  const wash = blocks.length > 1 ? ramp(f, washAt, 8, Easing.bezier(0.3, 0, 0.2, 1)) : 0;

  const sfx: React.ReactNode[] = [];
  for (let k = 0; k < prompt.length; k += 2 + (rand(k * 3) > 0.5 ? 1 : 0)) {
    sfx.push(<Sfx key={`k${k}`} at={TYPE0 + p.typing.out[k]} name="key" seed={k} volume={0.1 + rand(k + 5) * 0.06} />);
  }
  sfx.push(<Sfx key="send" at={send} name="send" volume={0.5} />);
  blocks.forEach((_, i) => sfx.push(<Sfx key={`p${i}`} at={p.cues[i]} name="pop" volume={Math.max(0.15, 0.3 - i * 0.05)} />));
  const artifact = (scene as { artifact?: { name?: string; at?: string } }).artifact;
  const artAt = artifact?.name ? cue(artifact.at, p.end + 4) : Infinity;
  if (artifact?.name) sfx.push(<Sfx key="art" at={artAt} name="pop" volume={0.45} />);

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: "hidden" }}>
      {sfx}
      <div style={{ position: "absolute", left: 0, top: 0, width: lay.FW, height: lay.FH, transform: `scale(${S})`, transformOrigin: "0 0", fontFamily: FONT.sans }}>
        <Stage look={L} keyLight={{ x: 0.5, y: vertical ? 0.12 : 0.02 }} fill={{ x: 0.88, y: 0.95 }} horizon={vertical ? 0.62 : 0.9} breathe={0.7} intensity={0.9} />
        <div style={{ position: "absolute", inset: 0, perspective: `${(PERSP * cam.zoom).toFixed(2)}px`, perspectiveOrigin: `${lay.SX}px ${lay.SY}px` }}>
          <div style={{
            position: "absolute", width: W, height: H, zoom: cam.zoom,
            transform: `translate(${(lay.SX / cam.zoom - cam.cx).toFixed(3)}px, ${(lay.SY / cam.zoom - cam.cy).toFixed(3)}px) rotateY(${cam.rotY.toFixed(3)}deg) rotateX(${cam.rotX.toFixed(3)}deg)`,
            transformOrigin: `${cam.cx.toFixed(2)}px ${cam.cy.toFixed(2)}px`,
            transformStyle: "preserve-3d",
          }}>
            {/* backlight in page space (moves in perspective with the window) */}
            <div style={{
              position: "absolute", left: -220, top: -180, width: W + 440, height: H + 400, pointerEvents: "none",
              background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(L.accent, 0.3)} 0%, ${alpha("#F2C7A5", 0.14)} 55%, transparent 72%)`,
              transform: "translateZ(-40px)",
            }} />
            <div style={{
              position: "absolute", left: 0, top: 0, width: W, height: H, borderRadius: 26, overflow: "hidden", background: PAPER,
              boxShadow: `0 0 0 1.5px ${alpha(L.ink, 0.07)}, 0 70px 160px -20px ${alpha(L.shadow, 0.38)}, 0 20px 60px ${alpha(L.shadow, 0.16)}`,
              display: "flex", flexDirection: "column",
            }}>
              {/* title bar */}
              <div style={{ height: 76, flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "0 28px", borderBottom: `1.5px solid ${L.line}` }}>
                {[0, 1, 2].map((k) => <div key={k} style={{ width: 16, height: 16, borderRadius: 8, background: alpha(L.ink, 0.12) }} />)}
                <div style={{ marginLeft: 18, width: 14, height: 14, borderRadius: 7, background: L.accent }} />
                <div style={{ fontSize: 28, fontWeight: 650, color: L.ink, letterSpacing: "-0.01em" }}>{app}</div>
              </div>

              {/* thread */}
              <div style={{ flex: 1, padding: "36px 40px 0", display: "flex", flexDirection: "column", gap: 34, overflow: "hidden", position: "relative" }}>
                {/* new-chat empty state (neutral terminal glyph + app name, no fake logo); clears as the prompt is sent */}
                {f < send + 8 && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 56, gap: 26,
                    opacity: 1 - ramp(f, send - 2, 8, EASE.out),
                  }}>
                    <div style={{ fontFamily: FONT.mono, fontSize: 84, fontWeight: 700, lineHeight: 1, color: L.ink2 }}>
                      {">"}<span style={{ color: L.accent }}>_</span>
                    </div>
                    <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em", color: L.ink }}>{app}</div>
                  </div>
                )}
                {sent && (
                  <div style={{
                    alignSelf: "flex-end", maxWidth: "82%", padding: "20px 28px", borderRadius: 30, borderBottomRightRadius: 10,
                    background: L.surface2, color: L.ink, fontSize: lay.fs.bubble, fontWeight: 500, lineHeight: 1.3,
                    opacity: Math.min(1, lift * 2), transform: `translateY(${((1 - lift) * 120).toFixed(1)}px) scale(${mix(0.94, 1, lift).toFixed(4)})`, transformOrigin: "100% 100%",
                  }}>{prompt}</div>
                )}
                {f >= send + 8 && (
                  <div style={{ display: "flex", gap: 22, opacity: ramp(f, send + 8, 8, EASE.out) }}>
                    <div style={{ width: 18, height: 18, marginTop: lay.fs.reply * 0.5, flex: "none", borderRadius: 9, background: L.accent }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: lay.fs.reply, fontWeight: 500, lineHeight: 1.35, color: L.ink, paddingTop: 4 }}>
                      {thinking && (
                        <div style={{ display: "flex", gap: 10, height: lay.fs.reply * 1.35, alignItems: "center" }}>
                          {[0, 1, 2].map((k) => <div key={k} style={{ width: 12, height: 12, borderRadius: 6, background: L.ink3, opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f / 3 - k * 1.2)) }} />)}
                        </div>
                      )}
                      {blocks.map((b, i) => {
                        if (f < p.cues[i]) return null;
                        const t = REVEAL_EASE(clamp01((f - p.cues[i]) / p.wipes[i]));
                        const c = Math.floor(t * b.length + 1e-6);
                        const last = i === lastI && blocks.length > 1;
                        return (
                          <div key={i} style={{ fontWeight: last ? 700 : 500 }}>
                            <span style={last ? {
                              backgroundImage: `linear-gradient(${alpha(L.accent, 0.28)}, ${alpha(L.accent, 0.28)})`, backgroundRepeat: "no-repeat",
                              backgroundSize: `${wash * 100}% 100%`, borderRadius: 6, WebkitBoxDecorationBreak: "clone", padding: "0 4px", margin: "0 -4px",
                            } : undefined}>{b.slice(0, c)}</span>
                            {i === caretIdx && <Caret h={lay.fs.reply * 1.1} opacity={t < 1 ? 1 : 1 - clamp01((f - p.cues[i] - p.wipes[i]) / 2)} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* composer */}
              <div style={{
                margin: compPad, marginTop: 0, minHeight: mix(compH, 112, lift), flex: "none", boxSizing: "border-box", borderRadius: 34,
                display: "flex", alignItems: "flex-end", gap: 16, padding: "22px 18px 18px 30px",
                background: L.surface2, boxShadow: `inset 0 0 0 1.5px ${alpha(L.ink, sent ? 0.08 : 0.08 + 0.1 * (1 - ramp(f, send - 4, 8)))}, 0 0 0 ${sent ? 0 : 4}px ${alpha(L.accent, sent ? 0 : 0.14)}`,
              }}>
                <div style={{ flex: 1, alignSelf: "center", fontSize: sent ? lay.fs.bubble : lay.fs.prompt, fontWeight: 500, lineHeight: 1.3, color: L.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {!sent && n > 0 ? prompt.slice(0, n) : <span style={{ color: L.ink3 }}>{f < TYPE0 || sent ? `Message ${app}…` : ""}</span>}
                  {!sent && <Caret h={lay.fs.prompt * 1.1} opacity={f < TYPE0 ? idleBlink : ready ? (Math.floor(f / 8) % 2 === 0 ? 1 : 0) : 1} />}
                </div>
                <div style={{
                  width: btn, height: btn, flex: "none", borderRadius: btn / 2, display: "flex", alignItems: "center", justifyContent: "center",
                  background: n > 0 && !sent ? L.accent : alpha(L.ink, 0.12), color: L.onAccent, fontSize: btn * 0.5, fontWeight: 700,
                  transform: `scale(${press.toFixed(4)})`, boxShadow: n > 0 && !sent ? `0 8px 22px -8px ${alpha(L.accent, 0.9)}` : "none",
                }}>↑</div>
              </div>
            </div>
          </div>
        </div>
        {artifact?.name && vertical && <GhostSlot at={artAt} send={send} f={f} />}
        {artifact?.name && <ArtifactTile name={artifact.name} at={artAt} f={f} vertical={vertical} />}
      </div>
    </AbsoluteFill>
  );
};

export const shot: ShotDef = { type: "chat", component: ChatPrompt, ground: "paper", fullBleed: true };
