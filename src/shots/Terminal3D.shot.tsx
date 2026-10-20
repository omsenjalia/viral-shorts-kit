// terminal: port of shotcraft camera/terminal-3d (demos/camera/terminal-3d/Terminal3D.tsx, Apache-2.0).
// Each `cmd` is a terminal window posed in 3D space; the camera is the inverse transform of the window's pose.
// 2–3 windows: the camera flies between them (30f swift + sin pull-back bulge, speed blur, depth of field).
// 1 window: push in + slow orbit so the frame never freezes. Typing starts on cue(at) with the demo's
// human jitter; `out` lines print terminal-fast with the braille spinner → ✓.
// Agent Mode: LOOKS.agentmode (warm ink + clay), FONT.mono, re-laid out for 1080×1920 (940-px windows,
// content in y 230–1150) as well as 1920×1080.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, FONT, SpeedBlur, mix, ramp } from "../sc/Polish";
import { Dust, LOOKS, Stage, alpha, glow } from "../sc/Look";
import { Sfx } from "../lib/fx";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";

const L = LOOKS.agentmode;
// stage light desaturated to a brown-clay so only prompt / ✓ / the hero line carry the accent (demo did the same with lime)
const STAGE = { ...L, light: "#6a4c3c", accent2: "#4a2a1c" };
const MONO = FONT.mono;
const PERSP = 1800;
const PULL_PEAK = 1250;
const OUT_GAP = 5; // frames between printed lines (demo: 4–6)

type Pose = { x: number; y: number; z: number; ry: number };
type Layout = { FW: number; FH: number; CX: number; CY: number; W: number; poses: Pose[]; view: number[]; key: { x: number; y: number }; horizon: number; stepSize: number };
const WIDE: Layout = {
  FW: 1920, FH: 1080, CX: 960, CY: 540, W: 1180,
  poses: [
    { x: -1500, y: -30, z: -220, ry: 24 },
    { x: 0, y: 30, z: 260, ry: -14 },
    { x: 1520, y: -40, z: -160, ry: 28 },
  ],
  view: [9, -8, 10], key: { x: 0.36, y: -0.06 }, horizon: 0.47, stepSize: 560,
};
// vertical: windows zigzag down-right so the pull-back bulge shows them stacked in the tall frame
const VERT: Layout = {
  FW: 1080, FH: 1920, CX: 540, CY: 690, W: 940,
  poses: [
    { x: -520, y: -320, z: -220, ry: 22 },
    { x: 440, y: 320, z: 260, ry: -14 },
    { x: -480, y: 960, z: -160, ry: 24 },
  ],
  view: [5, -4, 6], key: { x: 0.36, y: 0.16 }, horizon: 0.36, stepSize: 440,
};
const TILT = -4;

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ───────────── data → windows ─────────────
type Line = { cmd?: string; out?: string; at?: string };
type Win = { name: string; cmd: string; at?: string; outs: string[] };
const toWins = (lines: Line[] | undefined): Win[] => {
  const wins: Win[] = [];
  for (const l of lines?.length ? lines : [{ cmd: "echo hello" }]) {
    if (l.cmd) wins.push({ name: l.cmd.trim().split(/\s+/)[0] ?? "", cmd: l.cmd, at: l.at, outs: [] });
    if (l.out != null) {
      if (!wins.length) wins.push({ name: "zsh", cmd: "", outs: [] });
      // the demo draws its own spinner → ✓, so drop a mark the script already wrote
      wins[wins.length - 1].outs.push(l.out.replace(/^\s*[✓✔✗×•*>-]\s*/u, ""));
    }
  }
  // shortcut: a 4th+ command is dropped (the pose table has 3 stations); add poses if episodes need more
  return wins.slice(0, 3);
};

// per-char typing rhythm: 0.75–1.65f jitter, +0.6f on spaces (k < 1 compresses when the scene is short)
const charTimes = (cmd: string, seed: number, k: number) => {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < cmd.length; i++) {
    out.push(t);
    t += (0.75 + rand(seed * 31 + i) * 0.9 + (cmd[i] === " " ? 0.6 : 0)) * k;
  }
  return { out, end: t };
};

type Plan = { typeAt: number[]; typing: ReturnType<typeof charTimes>[]; enter: number[]; fly: [number, number][]; end: number };
const outSpan = (w: Win) => 2 + (w.outs.length ? (w.outs.length - 1) * OUT_GAP + 8 : 6); // enter → last line settled
const planOf = (wins: Win[], cue: SceneCtx["cue"], dur: number): Plan => {
  // Rhythms from the demo's (30f flights, 14f holds) down to a hard cut (fly 0). The gentlest one that types every
  // later window on its spoken cue (≤3f late) wins; else the one with the least lag. When the next window's cue is
  // close, the previous window types earlier than its own cue (backward pass) so the hand-off can land on the word.
  const tries = [[1, 30, 14], [0.85, 28, 12], [0.7, 26, 10], [0.58, 24, 8], [0.5, 22, 5], [0.5, 18, 2], [0.45, 0, 6], [0.4, 0, 4]];
  const cues = wins.map((w) => cue(w.at, Infinity));
  let best: Plan | null = null;
  let bestLag = Infinity;
  let p: Plan = { typeAt: [], typing: [], enter: [], fly: [], end: 0 };
  for (const [k, fly, hold] of tries) {
    const typing = wins.map((w, i) => charTimes(w.cmd, i + 3, k));
    // backward: the latest each window may start typing so the next one still starts on its target
    const target: number[] = [];
    for (let i = wins.length - 1; i >= 0; i--) {
      const latest = i === wins.length - 1 ? Infinity : target[i + 1] - 2 - fly - hold - outSpan(wins[i]) - typing[i].end - 2;
      target[i] = Math.min(cues[i], latest);
    }
    p = { typeAt: [], typing, enter: [], fly: [], end: 0 };
    let free = 0;
    let lag = 0;
    wins.forEach((w, i) => {
      const earliest = i === 0 ? 8 : free + hold + fly + 2;
      const t = Math.max(earliest, Number.isFinite(target[i]) ? target[i] : earliest);
      if (i > 0 && Number.isFinite(cues[i])) lag += Math.max(0, t - cues[i]);
      if (i > 0) p.fly.push([t - fly - 2, t - 2]);
      const ent = t + typing[i].end + 2; // 2f pause, then "enter"
      p.typeAt.push(t);
      p.enter.push(ent);
      free = ent + outSpan(w);
    });
    p.end = free;
    if (free + 16 > dur) continue;
    if (lag <= 3) return p;
    if (lag < bestLag) {
      best = p;
      bestLag = lag;
    }
  }
  return best ?? p;
};

// ───────────── camera ─────────────
type Cam = { s: number; pull: number; pose: Pose; yaw: number };
const camAt = (f: number, plan: Plan, lay: Layout, n: number, dur: number): Cam => {
  let s = 0;
  let pull = 260 * (1 - ramp(f, 0, 24, EASE.out)); // opening push-in
  plan.fly.forEach(([a, b], i) => {
    s += ramp(f, a, b - a, EASE.swift); // b === a is a hard cut (ramp guards the zero length)
    const raw = b > a ? clamp01((f - a) / (b - a)) : 0;
    pull += Math.sin(Math.PI * Math.pow(raw, 0.85)) * PULL_PEAK * (i === 0 ? 1 : 1.05);
  });
  let orbit = 0;
  if (n === 1) {
    // one window: keep the camera alive — slow orbit across the window + a gentle push
    orbit = mix(0, -13, ramp(f, 0, dur, EASE.smooth));
    pull -= 80 * ramp(f, 20, Math.max(1, dur - 20), EASE.smooth);
  } else {
    pull -= 36 * ramp(f, plan.end, 24, EASE.smooth); // tail creep ~2%
  }
  const i0 = Math.max(0, Math.min(n - 2, Math.floor(s)));
  const k = n === 1 ? 0 : s - i0;
  const a = lay.poses[i0], b = lay.poses[Math.min(n - 1, i0 + 1)];
  const pose: Pose = { x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), z: mix(a.z, b.z, k), ry: mix(a.ry, b.ry, k) };
  const view = mix(lay.view[i0], lay.view[Math.min(n - 1, i0 + 1)], k) + orbit;
  return { s, pull, pose, yaw: view - pose.ry };
};

// isomorphic to the world transform: translateZ(-pull) rotateX(TILT) rotateY(yaw) translate(-pose)
const project = (cam: Cam, p: [number, number, number]) => {
  const x0 = p[0] - cam.pose.x, y0 = p[1] - cam.pose.y, z0 = p[2] - cam.pose.z;
  const ty = (cam.yaw * Math.PI) / 180, tx = (TILT * Math.PI) / 180;
  const x1 = x0 * Math.cos(ty) + z0 * Math.sin(ty);
  const z1 = -x0 * Math.sin(ty) + z0 * Math.cos(ty);
  const y2 = y0 * Math.cos(tx) - z1 * Math.sin(tx);
  const z2 = y0 * Math.sin(tx) + z1 * Math.cos(tx) - cam.pull;
  return { x: x1, y: y2, z: z2 };
};
const toScreen = (lay: Layout, q: { x: number; y: number; z: number }) => {
  const k = PERSP / (PERSP - q.z);
  return { x: lay.CX + q.x * k, y: lay.CY + q.y * k, k };
};

const Floor: React.FC<{ cam: Cam; lay: Layout; floorY: number }> = ({ cam, lay, floorY }) => {
  const segs: React.ReactNode[] = [];
  const CELL = 240;
  const near = PERSP - 120;
  const line = (a: [number, number, number], b: [number, number, number], key: string) => {
    const N = 8;
    for (let j = 0; j < N; j++) {
      const pa = project(cam, [mix(a[0], b[0], j / N), a[1], mix(a[2], b[2], j / N)]);
      const pb = project(cam, [mix(a[0], b[0], (j + 1) / N), a[1], mix(a[2], b[2], (j + 1) / N)]);
      if (pa.z > near || pb.z > near) continue;
      const depth = PERSP - (pa.z + pb.z) / 2;
      const op = Math.max(0, Math.min(1, 1.25 - depth / 4200));
      if (op < 0.02) continue;
      const sa = toScreen(lay, pa), sb = toScreen(lay, pb);
      segs.push(<line key={`${key}${j}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} strokeOpacity={op * op} />);
    }
  };
  for (let i = -14; i <= 14; i++) line([i * CELL, floorY, -3600], [i * CELL, floorY, 2400], `c${i}`);
  for (let j = -15; j <= 10; j++) line([-3400, floorY, j * CELL], [3400, floorY, j * CELL], `r${j}`);
  return (
    <svg width={lay.FW} height={lay.FH} style={{ position: "absolute", inset: 0 }}>
      <g stroke={alpha(L.accent, 0.3)} strokeWidth={1.4}>{segs}</g>
    </svg>
  );
};

const FloorPool: React.FC<{ cam: Cam; lay: Layout; p: Pose; on: number; floorY: number }> = ({ cam, lay, p, on, floorY }) => {
  if (on < 0.02) return null;
  const q = project(cam, [p.x, floorY, p.z]);
  if (q.z > PERSP - 200) return null;
  const s = toScreen(lay, q);
  const w = 1500 * s.k, h = 260 * s.k;
  return (
    <div style={{
      position: "absolute", left: s.x - w / 2, top: s.y - h / 2, width: w, height: h, borderRadius: "50%",
      background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(L.accent, 0.24 * on)} 0%, ${alpha(L.accent, 0.07 * on)} 45%, ${alpha(L.accent, 0)} 72%)`,
    }} />
  );
};

const BackLight: React.FC<{ cam: Cam; lay: Layout; p: Pose; on: number }> = ({ cam, lay, p, on }) => {
  if (on < 0.02) return null;
  const q = project(cam, [p.x, p.y - 60, p.z - 300]);
  if (q.z > PERSP - 200) return null;
  const s = toScreen(lay, q);
  const w = 2500 * s.k, h = 1250 * s.k;
  return (
    <div style={{
      position: "absolute", left: s.x - w / 2, top: s.y - h / 2, width: w, height: h, borderRadius: "50%",
      background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha("#f2d2b8", 0.26 * on)} 0%, ${alpha("#c89878", 0.1 * on)} 46%, ${alpha("#b88a6a", 0)} 72%)`,
    }} />
  );
};

// ───────────── terminal window ─────────────
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const Mark: React.FC<{ t: number; forever?: boolean }> = ({ t, forever }) => {
  const done = !forever && t > 6;
  return (
    <span style={{ display: "inline-block", width: "1.6em", flex: "none", color: done ? L.accent : L.ink3 }}>
      {done ? "✓" : SPIN[Math.floor(Math.max(0, t) * 1.5) % SPIN.length]}
    </span>
  );
};

type Metrics = { W: number; H: number; pad: number; cmdFs: number; outFs: number };
const metricsOf = (wins: Win[], W: number): Metrics => {
  const pad = W > 1000 ? 56 : 46;
  const inner = W - pad * 2;
  const longest = Math.max(...wins.map((w) => w.cmd.length + 2));
  // one line at ≤52px if it fits at ≥44px (wide) / 46px (vertical); otherwise wrap (≥40px on a phone, the brief's floor)
  const cmdFs = Math.min(52, Math.max(W > 1000 ? 44 : 46, inner / (0.6 * longest)));
  const outFs = W > 1000 ? 38 : 40;
  const rows = (len: number, fs: number, indent = 0) => Math.max(1, Math.ceil((len + indent) / Math.floor(inner / (0.6 * fs))));
  const need = Math.max(...wins.map((w) => {
    const outRows = w.outs.length ? w.outs.reduce((a, o) => a + rows(o.length, outFs, 1.6), 0) : 1;
    return 72 + 52 + rows(w.cmd.length + 2, cmdFs) * cmdFs * 1.2 + 44 + outRows * outFs * 1.5 + 56;
  }));
  return { W, H: Math.round(Math.min(W > 1000 ? 720 : 820, Math.max(W > 1000 ? 460 : 500, need))), pad, cmdFs, outFs };
};

const Terminal: React.FC<{
  w: Win; i: number; frame: number; focus: number; plan: Plan; m: Metrics; title: string; hero: boolean;
}> = ({ w, i, frame, focus, plan, m, title, hero }) => {
  const t0 = plan.typeAt[i];
  const tf = frame - t0;
  const n = plan.typing[i].out.filter((x) => x <= tf).length;
  const typing = tf >= 0 && n < w.cmd.length;
  const ent = plan.enter[i];
  const caretOn = typing || Math.floor((frame - (tf < 0 ? 0 : t0 + plan.typing[i].end)) / 8) % 2 === 0;
  const out0 = ent + 2;
  const outs = w.outs.length ? w.outs : null;
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden",
      background: "linear-gradient(180deg, #24201c 0%, #1b1815 30%, #121110 100%)",
      boxShadow: `inset 0 0 0 1.5px ${alpha("#ffe8d8", 0.1 + 0.08 * focus)}, inset 0 2px 0 ${alpha("#ffffff", 0.08 + 0.1 * focus)}`,
      fontFamily: MONO,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, right: 0, height: 72, display: "flex", alignItems: "center",
        padding: "0 30px", gap: 14, borderBottom: `1.5px solid ${alpha("#ffe8d8", 0.07)}`,
        background: `linear-gradient(180deg, ${alpha("#ffffff", 0.035)}, ${alpha("#ffffff", 0)})`,
      }}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ width: 16, height: 16, borderRadius: 8, background: alpha(L.ink, 0.16), boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.12)}` }} />
        ))}
        <div style={{ marginLeft: 22, fontSize: 24, fontWeight: 700, color: L.accent, letterSpacing: "0.04em" }}>{String(i + 1).padStart(2, "0")}</div>
        <div style={{ fontSize: 24, fontWeight: 500, color: L.ink2, letterSpacing: "0.02em" }}>{w.name}</div>
        <div style={{ marginLeft: "auto", fontSize: 22, color: L.ink3 }}>{title} — zsh</div>
      </div>

      <div style={{ position: "absolute", left: m.pad, right: m.pad, top: 72 + 52 }}>
        {/* command: persistent prompt + typed chars + a block caret glued to the last char (wraps like a terminal) */}
        <div style={{ fontSize: m.cmdFs, fontWeight: 600, color: L.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.2 }}>
          <span style={{ color: L.accent }}>❯ </span>
          {w.cmd.slice(0, Math.max(0, n))}
          {frame < ent + 1 && (
            <span style={{
              display: "inline-block", width: "0.58em", height: "1.08em", marginLeft: 4, verticalAlign: "-0.16em",
              borderRadius: 3, background: L.accent, opacity: caretOn ? 0.95 : 0,
            }} />
          )}
        </div>

        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: m.outFs * 0.42 }}>
          {(outs ?? [null]).map((o, k) => {
            const at = out0 + k * OUT_GAP;
            const p = ramp(frame, at, 6, EASE.snappy);
            if (p <= 0) return null;
            const lt = frame - at;
            const last = hero && outs && k === outs.length - 1;
            const pop = last ? ramp(frame, at, 14, EASE.overshoot) : 1;
            const g = last ? ramp(frame, at, 26, EASE.out) : 0;
            return (
              <div key={k} style={{
                display: "flex", fontSize: m.outFs, fontWeight: last ? 700 : 500, lineHeight: 1.3, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                color: last ? L.accent : o == null ? L.ink3 : L.ink,
                textShadow: last ? glow(L.accent, 0.55 * g) : undefined,
                opacity: Math.min(1, p * 1.8),
                transform: `translateX(${((1 - p) * -10).toFixed(2)}px) scale(${mix(0.94, 1, pop).toFixed(4)})`, transformOrigin: "left center",
              }}>
                <Mark t={lt} forever={o == null} />
                <span>{o ?? "running…"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ───────────── tools chips (screen space, not in the 3D world) ─────────────
// optional `tools: [{ name, at }]`: each chip drops in on its spoken name. Vertical: the lower band
// (y 1450–1690, x < 960 so YouTube's buttons never cover them). Wide: a row above the windows.
type Tool = { name: string; at?: string };
const Chips: React.FC<{ tools: Tool[]; times: number[]; frame: number; vertical: boolean }> = ({ tools, times, frame, vertical }) => {
  const fs = vertical ? 50 : 34;
  return (
    <div style={{
      position: "absolute", display: "flex", flexWrap: "wrap", gap: vertical ? 20 : 16,
      ...(vertical ? { left: 80, top: 1450, width: 860 } : { left: 160, right: 160, top: 150, justifyContent: "center" }),
    }}>
      {tools.map((t, i) => {
        const at = times[i];
        if (frame < at) return null;
        const p = ramp(frame, at, 14, EASE.overshoot);
        const hit = 1 - ramp(frame, at + 4, 14, EASE.out); // border flash as it lands
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: fs * 0.36, height: fs * 2.1, padding: `0 ${fs * 0.7}px`, borderRadius: fs * 1.05,
            background: `linear-gradient(180deg, #2a2521, ${L.surface})`, color: L.ink, fontFamily: FONT.sans, fontSize: fs, fontWeight: 700, letterSpacing: "-0.01em",
            boxShadow: `inset 0 0 0 1.5px ${alpha(L.accent, 0.3 + 0.6 * hit)}, inset 0 2px 0 ${alpha("#ffffff", 0.08)}, 0 18px 40px -12px ${alpha("#000000", 0.8)}, 0 0 ${30 * hit}px ${alpha(L.accent, 0.4 * hit)}`,
            opacity: ramp(frame, at, 4, EASE.linear), transform: `translateY(${((1 - p) * -70).toFixed(1)}px) scale(${mix(0.9, 1, p).toFixed(4)})`,
          }}>
            <div style={{ width: fs * 0.32, height: fs * 0.32, borderRadius: fs, background: L.accent, flex: "none" }} />
            {t.name}
          </div>
        );
      })}
    </div>
  );
};

// ───────────── shot ─────────────
const Terminal3D: React.FC<SceneCtx<"terminal">> = ({ scene, dur, S, vertical, cue }) => {
  const frame = useCurrentFrame();
  const lay = vertical ? VERT : WIDE;
  const wins = toWins(scene.lines);
  const n = wins.length;
  const plan = planOf(wins, cue, dur);
  const m = metricsOf(wins, lay.W);
  const poses = lay.poses.slice(0, n);
  const floorY = Math.max(...poses.map((p) => p.y)) + m.H / 2 + 180;
  const cam = camAt(frame, plan, lay, n, dur);
  const v = cam.pose;

  const a = camAt(frame - 0.5, plan, lay, n, dur), b = camAt(frame + 0.5, plan, lay, n, dur);
  const kS = PERSP / (PERSP + cam.pull);
  const vx = -(b.pose.x - a.pose.x) * kS;
  const vy = -(b.pose.y - a.pose.y) * kS;

  const world = `translateZ(${(-cam.pull).toFixed(2)}px) rotateX(${TILT}deg) rotateY(${cam.yaw.toFixed(3)}deg) translate3d(${(-v.x).toFixed(2)}px,${(-v.y).toFixed(2)}px,${(-v.z).toFixed(2)}px)`;
  const title = scene.title ?? "~";
  const tools = ((scene as { tools?: Tool[] }).tools ?? []).filter((t) => t?.name);
  // fallback: one chip every 10f after the first command lands
  const toolAt = tools.map((t, i) => cue(t.at, (plan.enter[0] ?? 30) + 10 + i * 10));

  const sfx: React.ReactNode[] = [];
  wins.forEach((w, i) => {
    // thinned keys: every 2–3 chars, quiet; a click on enter
    for (let k = 0; k < w.cmd.length; k += 2 + (rand(i * 17 + k) > 0.5 ? 1 : 0)) {
      sfx.push(<Sfx key={`k${i}-${k}`} at={plan.typeAt[i] + plan.typing[i].out[k]} name="key" seed={i * 31 + k} volume={0.1 + rand(k + i * 7) * 0.06} />);
    }
    sfx.push(<Sfx key={`e${i}`} at={plan.enter[i]} name="click" volume={0.5} />);
  });
  plan.fly.forEach(([a0, b0], i) => sfx.push(<Sfx key={`f${i}`} at={a0} name={b0 > a0 ? "slide" : "switch"} volume={0.28} />));
  toolAt.forEach((at, i) => sfx.push(<Sfx key={`t${i}`} at={at} name="pop" volume={0.32} />));

  return (
    <AbsoluteFill style={{ background: L.bg[2], overflow: "hidden" }}>
      {sfx}
      <div style={{ position: "absolute", left: 0, top: 0, width: lay.FW, height: lay.FH, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <Stage look={STAGE} keyLight={lay.key} fill={{ x: 0.82, y: 1.0 }} horizon={lay.horizon} intensity={1} breathe={0.4}>
          <Floor cam={cam} lay={lay} floorY={floorY} />
          {poses.map((p, i) => <BackLight key={`b${i}`} cam={cam} lay={lay} p={p} on={Math.max(0, 1 - Math.abs(cam.s - i))} />)}
          {poses.map((p, i) => <FloorPool key={`p${i}`} cam={cam} lay={lay} p={p} floorY={floorY} on={Math.max(0, 1 - Math.abs(cam.s - i))} />)}
          <Dust look={L} count={36} seed={5} drift={0.35} opacity={0.4} />
        </Stage>
        <SpeedBlur vx={vx} vy={vy} amount={0.14} max={10}>
          <div style={{ position: "absolute", inset: 0, perspective: PERSP, perspectiveOrigin: `${lay.CX}px ${lay.CY}px`, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: lay.CX, top: lay.CY, width: 0, height: 0, transformStyle: "preserve-3d", transform: world }}>
              {poses.map((p, i) => {
                // depth of field: blurrier the farther from the current station; shallower when pulled back
                const wide = clamp01(cam.pull / PULL_PEAK);
                const focus = Math.min(1, Math.max(0, 1 - Math.abs(cam.s - i) * 1.25) + wide * 0.45);
                const blur = (1 - focus) * 3;
                return (
                  <React.Fragment key={i}>
                    {n > 1 && (
                      <div style={{
                        position: "absolute", left: -m.W / 2 - 120, top: -m.H / 2 - lay.stepSize * 0.48, whiteSpace: "nowrap",
                        transform: `translate3d(${p.x}px,${p.y}px,${p.z - 380}px) rotateY(${p.ry}deg)`,
                        fontFamily: FONT.sans, fontSize: lay.stepSize, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.05em",
                        color: "transparent", WebkitTextStroke: `2px ${alpha(L.accent, 0.07 + 0.28 * focus)}`,
                      }}>{String(i + 1).padStart(2, "0")}</div>
                    )}
                    <div style={{
                      position: "absolute", left: -m.W / 2, top: -m.H / 2, width: m.W, height: m.H,
                      transform: `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry}deg)`,
                      borderRadius: 22,
                      boxShadow: `0 50px 120px ${alpha("#000000", 0.7)}, 0 0 0 1px ${alpha("#000000", 0.4)}, 0 0 90px ${alpha(L.accent, 0.07 * focus)}`,
                      filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px) brightness(${(0.62 + 0.38 * focus).toFixed(3)})` : undefined,
                      opacity: 0.72 + 0.28 * focus,
                    }}>
                      <Terminal w={wins[i]} i={i} frame={frame} focus={focus} plan={plan} m={m} title={title} hero={i === n - 1} />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </SpeedBlur>
        <Chips tools={tools} times={toolAt} frame={frame} vertical={vertical} />
      </div>
    </AbsoluteFill>
  );
};

export const shot: ShotDef = { type: "terminal", component: Terminal3D, ground: "ink", fullBleed: true };
