// NewsPage (type "source"): the real article, crash-zoomed onto its headline, then the key phrase marked as it's spoken.
// Port of shotcraft camera/crash-zoom-punch, rebound variant (demos/camera/crash-zoom-punch/CrashZoomReal.tsx):
// wide hold on a browser window tilted back on a dark stage → four clay corner brackets lock the headline →
// wind-up → 6f log-space crash zoom with time-sampled motion blur → damped rebound, warm flash, surround pressed
// to 86% dark, clay outline → (our beat) clay marker grows behind the accent words on cue(accent).
// The marker sits on the real screenshot with multiply: a highlighter box on a light page, clay letters on a dark one.
// Its word rects come from shots.json (scripts/capture.mjs). Vertical swaps to the 3x mobile capture so the
// headline wraps narrow and reads big on a phone. No `shot`, or a missing file: the same camera on a recreated page.
//
// Data: { shot?: "episodes/<slug>/shots/<file>.png", focus?: [x,y,w,h] fractions | "h1", publisher, headline, date?, accent?, url?, hideDate? }
// hideDate: blurs the page's own date text (rects from shots.json) for a story that isn't fresh.
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Img, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ShotDef } from "./registry";
import type { SceneCtx } from "../types";
import { Dust, LOOKS, Stage, alpha, type } from "../sc/Look";
import { EASE, FONT, Vignette, mix, ramp, softShadow } from "../sc/Polish";
import { Sfx } from "../lib/fx";

const L = LOOKS.agentmode;
const PAPER = { bg: "#FAF9F5", ink: "#141413", ink2: "#5e554b", line: "rgba(20,20,19,0.10)" };

type Box = { x: number; y: number; w: number; h: number };
type Word = Box & { text: string };
// Everything in page CSS px. src null = recreated page.
type Page = { src: string | null; w: number; h: number; target: Box; words: Word[]; dates: Box[]; url?: string };

type Manifest = {
  pages: {
    url: string;
    files: Record<"full" | "hero" | "mobile", { file: string; cssW: number; cssH: number }>;
    desktop: Layout;
    mobile: Layout;
  }[];
};
type Layout = { h1: (Box & { words: Word[] }) | null; dates?: (Box & { text: string })[] };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const DEFAULT_FOCUS: [number, number, number, number] = [0.04, 0.12, 0.92, 0.16];

// Recreated page (fallback): fixed layout, so the headline box is known without measuring.
const recreated = (headline: string, vertical: boolean): Page => {
  const w = vertical ? 430 : 1280;
  const fs = vertical ? 40 : 76;
  const tw = vertical ? w - 48 : 1000;
  const lines = Math.max(1, Math.ceil((headline.length * fs * 0.54) / tw));
  return { src: null, w, h: vertical ? 1050 : 1200, target: { x: 24, y: vertical ? 270 : 300, w: tw, h: lines * fs * 1.08 }, words: [], dates: [] };
};

// Loads the screenshot's manifest (optional) and checks the file exists, holding the render until both settle.
const usePage = (shot: string | undefined, focus: unknown, headline: string, vertical: boolean): Page | null => {
  const [page, setPage] = useState<Page | null>(null);
  const [handle] = useState(() => delayRender("NewsPage: loading shot"));
  useEffect(() => {
    let live = true;
    const done = (p: Page) => {
      if (!live) return;
      setPage(p);
      continueRender(handle);
    };
    if (!shot) return done(recreated(headline, vertical)), undefined;
    const dir = shot.slice(0, shot.lastIndexOf("/"));
    const file = shot.slice(shot.lastIndexOf("/") + 1);
    const imgSize = (src: string) =>
      new Promise<{ w: number; h: number } | null>((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res(null);
        im.src = staticFile(src);
      });
    fetch(staticFile(`${dir}/shots.json`))
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null)
      .then(async (m) => {
        const entry = m?.pages.find((p) => Object.values(p.files).some((f) => f.file === file));
        const useH1 = !Array.isArray(focus);
        // vertical + headline focus: the mobile capture wraps the headline narrow, so it reads bigger
        const kind = entry ? (vertical && useH1 && entry.files.mobile ? "mobile" : (Object.keys(entry.files) as (keyof Manifest["pages"][0]["files"])[]).find((k) => entry.files[k].file === file)!) : null;
        const meta = entry && kind ? entry.files[kind] : null;
        const src = meta ? `${dir}/${meta.file}` : shot;
        const size = await imgSize(src);
        if (!size) return done(recreated(headline, vertical)); // missing file: never crash the episode
        const w = meta?.cssW ?? size.w / 2;
        const h = meta?.cssH ?? size.h / 2;
        const layout = entry && kind ? (kind === "mobile" ? entry.mobile : entry.desktop) : null;
        const h1 = layout?.h1 ?? null;
        const fr = Array.isArray(focus) && focus.length === 4 ? (focus as number[]) : DEFAULT_FOCUS;
        // the text's own extent (union of word rects), not the h1 element, which often spans the whole column
        const ws = h1?.words ?? [];
        const tight = ws.length ? (() => {
          const x = Math.min(...ws.map((b) => b.x)), y = Math.min(...ws.map((b) => b.y));
          return { x, y, w: Math.max(...ws.map((b) => b.x + b.w)) - x, h: Math.max(...ws.map((b) => b.y + b.h)) - y };
        })() : h1;
        const target = useH1 && tight ? { x: tight.x, y: tight.y, w: tight.w, h: tight.h } : { x: fr[0] * w, y: fr[1] * h, w: fr[2] * w, h: fr[3] * h };
        done({ src, w, h, target, words: useH1 && h1 ? h1.words : [], dates: layout?.dates ?? [], url: entry?.url });
      });
    return () => {
      live = false;
    };
  }, [shot, focus, headline, vertical, handle]);
  return page;
};

// Which headline words to mark: the first run matching the accent phrase, else any word in it.
const accentIdx = (words: string[], accent: string | undefined) => {
  const acc = (accent ?? "").split(/\s+/).map(norm).filter(Boolean);
  if (!acc.length) return [];
  const ws = words.map(norm);
  for (let i = 0; i + acc.length <= ws.length; i++) if (acc.every((a, k) => ws[i + k] === a)) return acc.map((_, k) => i + k);
  return ws.flatMap((w, i) => (acc.includes(w) ? [i] : []));
};

export const NewsPage: React.FC<SceneCtx<string>> = (ctx) => {
  const { scene, vertical } = ctx;
  const headline: string = scene.headline ?? "";
  const page = usePage(scene.shot, scene.focus ?? "h1", headline, vertical);
  if (!page) return null;
  return <Shot {...ctx} page={page} />;
};

const CHROME = 54;
const WIN_R = 18;
const SHUTTER = 0.55; // frames (≈200° shutter)

const Shot: React.FC<SceneCtx<string> & { page: Page }> = ({ scene, dur, S, vertical: V, cue, page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const publisher: string = scene.publisher ?? "";
  const headline: string = scene.headline ?? "";
  const date: string | undefined = scene.date;
  const accent: string | undefined = scene.accent;
  const hideDate = !!scene.hideDate;

  // ---- framing (design space: 1080×1920 vertical / 1920×1080 wide; content mass stays in y 230–1150 on Shorts) ----
  const W0 = V ? 1080 : 1920;
  const H0 = V ? 1920 : 1080;
  const CY = V ? 690 : 430;
  const T = page.target;
  const TC = { x: T.x + T.w / 2, y: T.y + T.h / 2 };
  const winH = Math.min(page.h, page.w * (V ? 1.6 : 0.9));
  const WIN = { x: 0, w: page.w, h: winH, y: Math.max(0, Math.min(page.h - winH, T.y + T.h > winH * 0.8 ? TC.y - winH * 0.4 : 0)) };
  const WIN_C = { x: WIN.x + WIN.w / 2, y: (WIN.y - CHROME + WIN.y + WIN.h) / 2 };
  const Z0 = Math.min((V ? 620 : 1500) / WIN.w, (V ? 900 : 860) / (WIN.h + CHROME));
  const REST = Math.min((V ? 930 : 1700) / T.w, (V ? 560 : 420) / T.h);
  const PEAK = REST * 1.06; // card: rebound 3–6%

  // ---- timeline: the crash lands before the accent is spoken; the marker grows on it ----
  const accWords = (accent ?? "").split(/\s+/).filter(Boolean);
  const said = cue(accWords[0], Math.round(dur * 0.5));
  // the crash starts on the first spoken word, so the headline is big inside the first second
  const firstWord = scene.captions?.length ? Math.round((scene.captions[0].startMs / 1000) * fps) : 0;
  const PUSH = Math.max(3, Math.min(firstWord + 3, dur - 40)); // lands (HIT) ≈ 0.3 s in
  const HIT = PUSH + 6;
  const LOCK = Math.max(0, PUSH - 14);
  const markAt = Math.max(said, HIT + 8);

  // camera: zoom (page px → screen px), target's screen position, tilt-back. Interpolating the target's screen
  // position (not the camera centre) keeps it converging monotonically during the crash.
  const camAt = (f: number) => {
    const settle = ramp(f, 0, PUSH - 6, EASE.smooth);
    const wind = ramp(f, PUSH - 6, 6, EASE.smooth);
    const z0 = Z0 * mix(1, 1.03, settle) * mix(1, 0.96, wind);
    const tilt0 = mix(13, 11, settle) + 1.5 * wind;
    const wideSx = W0 / 2 + (TC.x - WIN_C.x) * z0;
    const wideSy = CY + (TC.y - WIN_C.y) * z0;
    let zoom = z0;
    let k = 0;
    if (f >= PUSH && f < HIT) {
      const p = ramp(f, PUSH, HIT - PUSH, EASE.exit);
      zoom = Math.exp(mix(Math.log(z0), Math.log(PEAK), p)); // log space: perceived speed accelerates evenly
      k = p;
    } else if (f >= HIT) {
      const t = f - HIT;
      zoom = REST + (PEAK - REST) * Math.exp(-t / 2.2) * Math.cos((Math.PI * t) / 5.2);
      zoom *= 1 + 0.015 * ramp(f, HIT + 50, Math.max(1, dur - HIT - 50), EASE.smooth); // tail creep, the frame stays alive
      k = 1;
    }
    const tilt = f >= PUSH ? tilt0 * (1 - ramp(f, PUSH, HIT - PUSH, EASE.exit)) : tilt0;
    return { zoom, sx: mix(wideSx, W0 / 2, k), sy: mix(wideSy, CY, k), tilt };
  };

  const lock = ramp(frame, LOCK, Math.min(16, PUSH - LOCK), EASE.snappy);
  const breath = ramp(frame, PUSH - 6, 6, EASE.smooth) * (1 - ramp(frame, PUSH, 4, EASE.exit));
  const lift = ramp(frame, HIT + 1, 16, EASE.out);
  const flash = frame >= HIT ? Math.exp(-(frame - HIT) / 3) : 0;
  const vig = 0.1 + 0.3 * ramp(frame, PUSH, HIT - PUSH, EASE.exit) - 0.36 * ramp(frame, HIT, 18, EASE.out);
  const wideFade = 1 - ramp(frame, PUSH, HIT - PUSH, EASE.exit);

  // motion blur only on the crash: equal-weight sub-frames, spacing ≤6px, capped at 44, plus a micro-blur to smear echoes
  const edgeAt = (f: number) => {
    const a = camAt(f), b = camAt(f - SHUTTER);
    return Math.abs(a.zoom - b.zoom) * 1100 + Math.hypot(a.sx - b.sx, a.sy - b.sy) + Math.abs(a.tilt - b.tilt) * 30;
  };
  const n = frame >= PUSH && frame <= HIT + 1 ? Math.max(1, Math.min(44, Math.ceil(edgeAt(frame) / 6))) : 1;
  const smear = n > 1 ? Math.min(4, (edgeAt(frame) / n) * 0.6 * Math.min(1, Math.max(0, (edgeAt(frame) - 60) / 200))) : 0;

  // marker: per word, left→right, 12f each, 3f stagger
  const marked = page.src ? accentIdx(page.words.map((w) => w.text), accent) : accentIdx(headline.split(/\s+/), accent);
  const markP = (k: number) => ramp(frame, markAt + k * 3, 12, EASE.snappy);

  const world = (f: number) => {
    const { zoom, sx, sy, tilt } = camAt(f);
    const tx = sx - TC.x * zoom;
    const ty = sy - TC.y * zoom;
    const pad = mix(V ? 90 : 150, 14, lock) + 8 * breath;
    const sw = 3 / zoom;
    const arm = 34 / Math.max(1, zoom * 0.7);
    const bx = T.x - pad, by = T.y - pad, bw = T.w + pad * 2, bh = T.h + pad * 2;
    const tilted = tilt > 0.01;
    return (
      <AbsoluteFill style={tilted ? { perspective: 2600, perspectiveOrigin: "50% 40%" } : undefined}>
        <AbsoluteFill style={tilted ? { transform: `rotateX(${tilt.toFixed(3)}deg)`, transformOrigin: "50% 60%" } : undefined}>
          <div style={{ position: "absolute", left: 0, top: 0, width: page.w, height: page.h, transformOrigin: "0 0", transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(5)})` }}>
            <div
              style={{
                position: "absolute", left: WIN.x, top: WIN.y - CHROME, width: WIN.w, height: WIN.h + CHROME, borderRadius: WIN_R, overflow: "hidden",
                background: PAPER.bg,
                boxShadow: `0 0 0 1px ${alpha(L.accent2, 0.22)}, 0 40px 90px -10px rgba(0,0,0,0.75), 0 12px 30px rgba(0,0,0,0.5)`,
              }}
            >
              <div style={{ position: "absolute", left: 0, top: 0, width: WIN.w, height: CHROME, background: "linear-gradient(180deg, #f1ebe2, #e9e2d7)", borderBottom: "1px solid rgba(60,40,20,0.12)" }}>
                {["#ef6a5b", "#f2be4f", "#5fc35a"].map((c, i) => (
                  <div key={c} style={{ position: "absolute", left: 24 + i * 24, top: 20, width: 14, height: 14, borderRadius: 7, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }} />
                ))}
                <div style={{ position: "absolute", left: V ? 104 : WIN.w / 2 - 260, right: V ? 16 : WIN.w / 2 - 260, top: 12, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.7)", boxShadow: "inset 0 0 0 1px rgba(60,40,20,0.1)", fontFamily: FONT.sans, fontSize: 15, color: "#8a7a68", display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                  {(page.url ?? scene.url ?? publisher).replace(/^https?:\/\/(www\.)?/, "").slice(0, V ? 34 : 72)}
                </div>
              </div>
              <div style={{ position: "absolute", left: 0, top: CHROME, width: WIN.w, height: WIN.h, overflow: "hidden" }}>
                <div style={{ position: "absolute", left: -WIN.x, top: -WIN.y, width: page.w, height: page.h }}>
                  {page.src ? <Img src={staticFile(page.src)} style={{ position: "absolute", width: page.w, height: page.h }} /> : <Recreated page={page} V={V} publisher={publisher} headline={headline} date={hideDate ? undefined : date} marked={marked} markP={markP} />}
                  {/* hideDate: an old story's date (and dated breadcrumb) is softly blurred in place, from shots.json */}
                  {page.src && hideDate && page.dates.map((d, i) => (
                    <div key={`d${i}`} style={{ position: "absolute", left: d.x - 5, top: d.y - 4, width: d.w + 10, height: d.h + 8, borderRadius: 6, overflow: "hidden" }}>
                      <Img src={staticFile(page.src!)} style={{ position: "absolute", left: -(d.x - 5), top: -(d.y - 4), width: page.w, height: page.h, filter: "blur(5px)" }} />
                    </div>
                  ))}
                  {/* call-out: a huge-spread shadow presses the surround to warm black; the headline keeps its own pixels */}
                  {lift > 0.001 && (
                    <div style={{ position: "absolute", left: T.x - 14, top: T.y - 10, width: T.w + 28, height: T.h + 20, borderRadius: 10, boxShadow: `0 0 0 4000px rgba(12,10,9,${(0.9 * lift).toFixed(3)}), ${softShadow(14 * lift, { color: "#000000", strength: 2.4 })}` }} />
                  )}
                  {page.src && marked.map((wi, k) => {
                    const w = page.words[wi];
                    const next = page.words[marked[k + 1] ?? -1];
                    const join = next && marked[k + 1] === wi + 1 && Math.abs(next.y - w.y) < w.h * 0.5 ? next.x - (w.x + w.w) : 0;
                    const p = markP(k);
                    if (p <= 0) return null;
                    const px = w.h * 0.08;
                    const width = (w.w + px * 2 + Math.max(0, join - px * 2)) * p;
                    return (
                      <React.Fragment key={wi}>
                        <div style={{ position: "absolute", left: w.x - px, top: w.y + w.h * 0.04, width, height: w.h * 0.92, background: L.accent, mixBlendMode: "multiply", borderRadius: w.h * 0.06 }} />
                        <div style={{ position: "absolute", left: w.x - px, top: w.y + w.h * 0.96, width, height: Math.max(3 / zoom, w.h * 0.07), background: L.accent }} />
                      </React.Fragment>
                    );
                  })}
                  {/* outline: the hero's one light effect */}
                  {lift > 0.001 && (
                    <div style={{ position: "absolute", left: T.x - 14, top: T.y - 10, width: T.w + 28, height: T.h + 20, borderRadius: 10, boxShadow: `0 0 0 ${(1.2 / zoom).toFixed(3)}px ${alpha(L.accent, 0.85 * lift)}, 0 0 ${(26 / zoom).toFixed(2)}px ${alpha(L.accent, 0.45 * lift)}` }} />
                  )}
                  {lock > 0.001 && (
                    <svg width={bw + 40} height={bh + 40} viewBox={`${bx - 20} ${by - 20} ${bw + 40} ${bh + 40}`} style={{ position: "absolute", left: bx - 20, top: by - 20, overflow: "visible", opacity: Math.min(1, lock * 4) * (1 - 0.35 * lift) }}>
                      <g fill="none" stroke={L.accent} strokeWidth={sw} strokeLinecap="square">
                        <path d={`M${bx} ${by + arm} V${by} H${bx + arm}`} />
                        <path d={`M${bx + bw - arm} ${by} H${bx + bw} V${by + arm}`} />
                        <path d={`M${bx + bw} ${by + bh - arm} V${by + bh} H${bx + bw - arm}`} />
                        <path d={`M${bx + arm} ${by + bh} H${bx} V${by + bh - arm}`} />
                      </g>
                    </svg>
                  )}
                </div>
              </div>
              <div style={{ position: "absolute", inset: 0, borderRadius: WIN_R, boxShadow: `inset 0 1px 0 ${alpha("#fff4e8", 0.9)}`, pointerEvents: "none" }} />
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  };

  // source credit under the headline (replaces the demo's right-hand readout: the headline is too wide to slide aside)
  const cam = camAt(frame);
  const creditTop = CY + (T.h / 2) * cam.zoom + (V ? 64 : 48);
  const creditLeft = W0 / 2 - (T.w / 2) * REST;
  const CR = HIT + 14;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sfx at={LOCK} name="click" volume={0.25} />
      <Sfx at={HIT - 1} name="hit" volume={0.5} />
      {marked.length > 0 && <Sfx at={markAt} name="pop" volume={0.35} />}
      <div style={{ position: "absolute", left: 0, top: 0, width: W0, height: H0, transform: `scale(${S})`, transformOrigin: "0 0", overflow: "hidden" }}>
        <Stage look={L} keyLight={{ x: 0.5, y: 0.0 }} fill={{ x: 0.5, y: 1.05 }} horizon={V ? 0.62 : 0.86} intensity={0.9} breathe={0.5} vignette={mix(0.1, 0.5, wideFade)}>
          {/* backlight behind the window + floor bounce, then dust: they set the stage for the wide shot */}
          <div style={{ position: "absolute", inset: 0, opacity: wideFade, background: `radial-gradient(ellipse ${V ? "52% 30%" : "38% 44%"} at 50% ${((CY / H0) * 100).toFixed(1)}%, ${alpha(L.accent, 0.34)}, ${alpha(L.accent, 0)} 70%)` }} />
          <div style={{ position: "absolute", left: V ? 180 : 360, right: V ? 180 : 360, top: CY + (V ? 440 : 410), height: 160, opacity: wideFade, borderRadius: "50%", background: `radial-gradient(closest-side, ${alpha(L.accent2, 0.24)}, ${alpha(L.accent2, 0)})`, filter: "blur(8px)" }} />
          {[0, ...(V ? [1] : [])].map((i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 960, height: 1080, opacity: wideFade }}>
              <Dust look={L} count={V ? 22 : 34} seed={7 + i} drift={0.3} opacity={0.55} color={L.accent2} />
            </div>
          ))}
        </Stage>

        {n > 1 ? (
          Array.from({ length: n }, (_, i) => (
            <AbsoluteFill key={i} style={{ opacity: 1 / (i + 1), filter: smear > 0.3 ? `blur(${smear.toFixed(2)}px)` : undefined }}>
              {world(frame - (SHUTTER * i) / (n - 1))}
            </AbsoluteFill>
          ))
        ) : (
          world(frame)
        )}

        {flash > 0.01 && (
          <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", background: `radial-gradient(ellipse 55% ${V ? "34%" : "60%"} at 50% ${((CY / H0) * 100).toFixed(1)}%, ${alpha(L.accent2, 0.32 * flash)}, ${alpha(L.accent, 0.12 * flash)} 55%, ${alpha(L.accent, 0)} 80%)` }} />
        )}

        {frame >= CR && (publisher || date) && (
          <div style={{ position: "absolute", left: 0, right: 0, top: creditTop - 40, height: (V ? 1480 : H0) - creditTop + 40, opacity: ramp(frame, CR, 12, EASE.out), background: `linear-gradient(180deg, ${alpha("#0c0a09", 0)}, ${alpha("#0c0a09", 0.94)} ${V ? 4 : 6}%, ${alpha("#0c0a09", 0.94)} 88%, ${alpha("#0c0a09", 0)})` }} />
        )}
        {frame >= CR && (publisher || date) && (
          <div style={{ position: "absolute", left: creditLeft, top: creditTop, width: W0 - creditLeft * 2, color: L.ink }}>
            <div style={{ ...type(V ? 34 : 28, 650, { caps: true }), letterSpacing: "0.18em", color: L.accent, display: "flex", alignItems: "center", gap: 16, opacity: ramp(frame, CR, 10, EASE.out), transform: `translateY(${(14 * (1 - ramp(frame, CR, 14, EASE.snappy))).toFixed(2)}px)` }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: L.accent, boxShadow: `0 0 14px ${alpha(L.accent, 0.8)}`, flex: "none" }} />
              {[scene.label ?? "Source", publisher].filter(Boolean).join(" · ")}
            </div>
            <div style={{ height: 2, width: V ? 520 : 640, marginTop: 22, background: alpha(L.ink, 0.16), transform: `scaleX(${ramp(frame, CR + 4, 22, EASE.snappy).toFixed(4)})`, transformOrigin: "0 50%" }} />
            {date && (
              <div style={{ ...type(V ? 40 : 32, 500), color: L.ink2, marginTop: 20, fontFamily: FONT.mono, opacity: ramp(frame, CR + 8, 12, EASE.out) }}>{date}</div>
            )}
          </div>
        )}
        <Vignette strength={Math.max(0, vig)} inner={0.42} color={L.shadow} cy={CY / H0} />
        {/* Shorts: the URL chip fills the band under the subtitles from frame 0 and types out its path */}
        {V && (
          <UrlChip url={(page.url ?? scene.url ?? publisher) as string} t={frame} frame={frame} />
        )}
      </div>
    </AbsoluteFill>
  );
};

const UrlChip: React.FC<{ url: string; t: number; frame: number }> = ({ url, t, frame }) => {
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  const cut = clean.indexOf("/");
  const host = cut < 0 ? clean : clean.slice(0, cut);
  const path = cut < 0 ? "" : clean.slice(cut);
  const typed = Math.min(path.length, Math.floor(Math.max(0, t - 6) * 2.4));
  const show = ramp(t, 0, 10, EASE.snappy); // on screen from frame 0: only a short rise, no fade
  return (
    <div style={{ position: "absolute", left: 90, top: 1520, maxWidth: 840, height: 84, padding: "0 30px", borderRadius: 42, display: "flex", alignItems: "center", gap: 18, background: alpha(L.surface2, 0.92), boxShadow: `0 0 0 1.5px ${alpha(L.accent, 0.35)}, 0 18px 40px rgba(0,0,0,0.5)`, transform: `translateY(${((1 - show) * 24).toFixed(1)}px)`, fontFamily: FONT.mono, fontSize: 30, whiteSpace: "nowrap", overflow: "hidden" }}>
      <svg viewBox="0 0 24 24" width={30} height={30} style={{ flex: "none" }}>
        <rect x={5} y={10} width={14} height={11} rx={2.5} fill={L.accent} />
        <path d="M8 10 V7.5 a4 4 0 0 1 8 0 V10" stroke={L.accent} strokeWidth={2.4} fill="none" />
      </svg>
      <span style={{ color: L.ink, fontWeight: 700 }}>{host}</span>
      <span style={{ color: L.ink3, overflow: "hidden", textOverflow: "ellipsis" }}>
        {path.slice(0, typed)}
        <span style={{ display: "inline-block", width: 14, height: 32, marginLeft: 3, verticalAlign: "middle", background: L.accent, opacity: typed < path.length || Math.floor(frame / 15) % 2 ? 1 : 0 }} />
      </span>
    </div>
  );
};

// Fallback: the article recreated as a clean ivory page in the same window (masthead, date, headline, lede, hero block).
const Recreated: React.FC<{ page: Page; V: boolean; publisher: string; headline: string; date?: string; marked: number[]; markP: (k: number) => number }> = ({ page, V, publisher, headline, date, marked, markP }) => {
  const T = page.target;
  const fs = V ? 40 : 76;
  return (
    <div style={{ position: "absolute", inset: 0, background: PAPER.bg, color: PAPER.ink, fontFamily: FONT.sans }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: V ? 64 : 84, borderBottom: `1px solid ${PAPER.line}`, display: "flex", alignItems: "center", gap: 12, padding: `0 ${T.x}px` }}>
        <div style={{ width: V ? 30 : 40, height: V ? 30 : 40, borderRadius: 8, background: L.accent, color: PAPER.ink, display: "grid", placeItems: "center", fontWeight: 800, fontSize: V ? 17 : 22 }}>{(publisher[0] ?? "N").toUpperCase()}</div>
        <div style={{ fontWeight: 750, fontSize: V ? 20 : 26, letterSpacing: "-0.01em" }}>{publisher}</div>
      </div>
      <div style={{ position: "absolute", left: T.x, top: T.y - (V ? 46 : 64), fontFamily: FONT.mono, fontSize: V ? 13 : 18, letterSpacing: "0.12em", color: L.accent, textTransform: "uppercase" }}>
        {["News", date].filter(Boolean).join(" · ")}
      </div>
      <div style={{ position: "absolute", left: T.x, top: T.y, width: T.w, fontSize: fs, fontWeight: 750, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
        {headline.split(/\s+/).map((w, i) => {
          const k = marked.indexOf(i);
          const p = k < 0 ? 0 : markP(k);
          return (
            <React.Fragment key={i}>
              <span style={{ backgroundImage: `linear-gradient(${L.accent}, ${L.accent})`, backgroundRepeat: "no-repeat", backgroundSize: `${(p * 100).toFixed(1)}% 88%`, backgroundPosition: "0 60%", padding: "0 0.06em", margin: "0 -0.06em" }}>{w}</span>{" "}
            </React.Fragment>
          );
        })}
      </div>
      {[100, 94, 62].map((w, i) => (
        <div key={i} style={{ position: "absolute", left: T.x, top: T.y + T.h + (V ? 30 : 44) + i * (V ? 26 : 34), height: V ? 12 : 16, width: (T.w * w) / 100, borderRadius: 8, background: "rgba(20,20,19,0.09)" }} />
      ))}
      <div style={{ position: "absolute", left: T.x, top: T.y + T.h + (V ? 130 : 180), width: V ? page.w - T.x * 2 : 860, height: V ? 230 : 420, borderRadius: 14, background: `linear-gradient(135deg, ${L.accent} 0%, #8f4a33 45%, ${PAPER.ink} 100%)` }} />
    </div>
  );
};

export const shot: ShotDef = { type: "source", component: NewsPage, ground: "ink", fullBleed: true };
