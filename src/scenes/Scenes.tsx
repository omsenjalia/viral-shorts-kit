// The scene library. Each scene SHOWS one idea at close range on a full-frame colour ground.
// Every beat lands on the narration word that names it (`cue`), and its sound sits on the same frame.
// Scenes never fade out: the cut (a push-through in Episode.tsx) is the exit.
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { BRAND } from "../../brand-template/brand";
import { Mascot } from "../../brand-template/Mascot";
import { E, SPR, hitPulse, mix, prog, rand, spr } from "../lib/anim";
import { HeroWords, Label, Panel, Sfx, toWords } from "../lib/fx";
import type { SceneCtx } from "../types";

const C = BRAND.colors;
const F = BRAND.fonts;

/** Content column: left-aligned, title-safe. */
const Column: React.FC<{ S: number; gap?: number; top?: number; children: React.ReactNode }> = ({ S, gap = 34, top, children }) => (
  <AbsoluteFill style={{ justifyContent: top === undefined ? "center" : "flex-start", paddingTop: top, gap: gap * S }}>{children}</AbsoluteFill>
);

/** A camera push: 1 -> `to` starting at frame a, optionally pulling back from frame c. */
const push = (f: number, a: number, to: number, c?: number) => {
  const inP = prog(f, a, a + 18, E.inOut);
  const outP = c === undefined ? 0 : prog(f, c, c + 16, E.inOut);
  return mix(1, to, inP * (1 - outP));
};

// ---------- hook: the claim, huge, words landing as they're spoken; Mo reacts ----------
export const Hook: React.FC<SceneCtx<"hook">> = ({ scene, S, vertical, G, cue }) => {
  let prev = -6;
  // spoken words land on their voice; others follow 4f behind; frame 0 is already composed
  const words = toWords(scene.text, scene.accent, (w, i) => {
    const t = i === 0 ? -6 : Math.max(prev + 4, Math.min(cue(w, prev + 4), prev + 10));
    prev = t;
    return t;
  });
  const last = words[words.length - 1].at;
  return (
    <AbsoluteFill>
      <Sfx at={0} name="hit" volume={0.7} />
      <Column S={S} top={vertical ? 40 * S : 60 * S}>
        <Label text={scene.label} g={G} S={S} />
        <div style={{ maxWidth: vertical ? "100%" : "64%" }}>
          <HeroWords words={words} size={(vertical ? 176 : 150) * S} g={G} box />
        </div>
      </Column>
      {/* on Shorts Mo stands below the subtitles (the stage ends above them) */}
      <div style={{ position: "absolute", left: vertical ? 0 : undefined, right: vertical ? undefined : 40 * S, bottom: vertical ? -620 * S : 0 }}>
        <Mascot size={(vertical ? 440 : 420) * S} mood={scene.mood ?? "shock"} enterDelay={last + 4} />
      </div>
      <Sfx at={last + 5} name="pop" volume={0.5} />
    </AbsoluteFill>
  );
};

// ---------- source: the news as a recreated article card, camera pushes into the headline ----------
export const Source: React.FC<SceneCtx<"source">> = ({ scene, dur, S, G, cue }) => {
  const f = useCurrentFrame();
  const inP = prog(f, 0, 14, E.out);
  const acc = (scene.accent ?? "").toLowerCase().split(" ").filter(Boolean);
  const markAt = cue(acc[0], 14);
  const cam = push(f, markAt - 6, 1.1) * mix(1, 1.03, prog(f, 0, dur, E.linear));
  const words = toWords(scene.headline, scene.accent, (_, i) => 4 + i * 2).map((w) => ({
    ...w,
    lead: false,
    at: w.accent ? Math.max(w.at, markAt - 2) : w.at,
  }));
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <Sfx at={0} name="slide" volume={0.55} />
      <Sfx at={markAt} name="pop" volume={0.35} />
      <Column S={S} gap={30}>
        <Label text={scene.label ?? "The news"} g={G} S={S} />
        <Panel
          g={G}
          S={S}
          style={{
            padding: 60 * S,
            display: "flex",
            flexDirection: "column",
            gap: 34 * S,
            transform: `translateY(${(1 - inP) * 260 * S}px) rotateX(${(1 - inP) * 20}deg) scale(${cam})`,
            transformOrigin: "50% 45%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 * S, fontFamily: F.body, fontSize: 40 * S }}>
            <div style={{ width: 68 * S, height: 68 * S, borderRadius: 16 * S, background: C.clay, color: C.ink, fontWeight: 900, display: "grid", placeItems: "center" }}>
              {scene.publisher[0]}
            </div>
            <span style={{ fontWeight: 700 }}>{scene.publisher}</span>
            {scene.date && <span style={{ opacity: 0.6 }}>· {scene.date}</span>}
          </div>
          <HeroWords words={words} size={96 * S} g={{ ...G, fg: G.panelFg, box: C.clay, boxFg: C.ink }} box />
          {[100, 92, 64].map((w, i) => (
            <div key={i} style={{ height: 20 * S, width: `${w * prog(f, 10 + i * 3, 24 + i * 3, E.out)}%`, borderRadius: 10 * S, background: "#ffffff14" }} />
          ))}
        </Panel>
      </Column>
    </AbsoluteFill>
  );
};

// ---------- statement: a build of 1-4 word lines, each landing on the word that says it ----------
export const Statement: React.FC<SceneCtx<"statement">> = ({ scene, dur, S, vertical, G, cue }) => {
  const n = scene.fragments.length;
  // the opener lands on frame 0 (never an empty frame after a cut); the rest land on their spoken word
  const starts = scene.fragments.map((fr, i) => (i === 0 ? 0 : cue(fr.at, Math.round((i * dur * 0.6) / n))));
  return (
    <AbsoluteFill>
      {starts.slice(1).map((s, i) => (
        <Sfx key={i} at={s - 1} name="pop" volume={0.3} />
      ))}
      <Column S={S} gap={vertical ? 30 : 18}>
        <Label text={scene.label} g={G} S={S} />
        {scene.fragments.map((fr, i) => (
          <HeroWords key={i} words={toWords(fr.text, scene.accent, (_, k) => starts[i] + k * 3)} size={(vertical ? 172 : 128) * S} g={G} />
        ))}
      </Column>
    </AbsoluteFill>
  );
};

// ---------- terminal: full-width, the camera goes macro on the command as it types ----------
const CPS_FRAMES = 1.1; // ~27 chars/s
export const Terminal: React.FC<SceneCtx<"terminal">> = ({ scene, dur, S, G, cue }) => {
  const f = useCurrentFrame();
  const inP = prog(f, 0, 12, E.out);
  let t = 6;
  const sched = scene.lines.map((l) => {
    const start = Math.max(t, cue(l.at, t));
    const len = l.cmd ? Math.ceil(l.cmd.length * CPS_FRAMES) : 4;
    t = start + len + (l.cmd ? 8 : 5);
    return { ...l, start, len };
  });
  const first = sched.find((l) => l.cmd) ?? sched[0];
  const firstDone = first.start + first.len;
  const active = [...sched].reverse().find((l) => f >= l.start);
  const caretOn = Math.floor(f / 12) % 2 === 0 || (active?.cmd && f < active.start + active.len);
  const longest = Math.max(...scene.lines.map((l) => (l.cmd ? l.cmd.length + 2 : (l.out ?? "").length)));
  // big mono that wraps (like a real terminal) beats a tiny line that fits
  const mono = Math.max(40 * S, Math.min(52 * S, (840 * S) / (longest * 0.6)));
  // macro: push in on the first command while it types, pull back as the rest arrives
  const cam = push(f, first.start - 4, 1.16, firstDone + 6) * mix(1, 1.03, prog(f, 0, dur, E.linear));
  const copied = f >= firstDone + 2;
  return (
    <AbsoluteFill>
      <Sfx at={0} name="slide" volume={0.35} />
      <Sfx at={firstDone + 2} name="click" volume={0.5} />
      <Column S={S} gap={30}>
        <Label text={scene.label} g={G} S={S} />
        <Panel g={G} S={S} style={{ transform: `translateY(${(1 - inP) * 140 * S}px) scale(${cam})`, transformOrigin: "10% 20%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 * S, padding: `${24 * S}px ${30 * S}px`, background: "#ffffff08", borderBottom: "1px solid #ffffff12" }}>
            {[C.clay, "#ffffff33", "#ffffff1a"].map((c) => (
              <div key={c} style={{ width: 20 * S, height: 20 * S, borderRadius: 99, background: c }} />
            ))}
            <span style={{ marginLeft: 14 * S, fontFamily: F.mono, fontSize: 30 * S, opacity: 0.7, flex: 1 }}>{scene.title ?? "terminal"}</span>
            <span
              style={{
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: 24 * S,
                letterSpacing: "0.12em",
                padding: `${6 * S}px ${16 * S}px`,
                borderRadius: 8 * S,
                background: copied ? C.clay : "#ffffff14",
                color: copied ? C.ink : "#ffffffaa",
              }}
            >
              {copied ? "COPIED" : "COPY"}
            </span>
          </div>
          <div style={{ padding: 44 * S, minHeight: 560 * S, fontFamily: F.mono, fontSize: mono, lineHeight: 1.5, wordBreak: "break-all" }}>
            {sched.map((l, i) => {
              if (f < l.start) return null;
              if (l.cmd) {
                const chars = Math.min(l.cmd.length, Math.floor((f - l.start) / CPS_FRAMES));
                const keys = [];
                for (let k = 0; k < l.cmd.length; k += 3) keys.push(<Sfx key={k} at={l.start + k * CPS_FRAMES} name="key" seed={i * 31 + k} volume={0.18 + rand(k + i) * 0.06} />);
                const hl = l === first ? prog(f, firstDone + 1, firstDone + 9, E.out) : 0;
                return (
                  <div key={i}>
                    {keys}
                    <span style={{ color: C.clay, fontWeight: 700 }}>$ </span>
                    {/* highlight sweep as a background so it follows the text across wrapped lines */}
                    <span
                      style={{
                        backgroundImage: `linear-gradient(${C.clay}, ${C.clay})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${hl * 100}% 100%`,
                        color: hl > 0.6 ? C.ink : undefined,
                        WebkitBoxDecorationBreak: "slice",
                      }}
                    >
                      {l.cmd.slice(0, chars)}
                    </span>
                    {active === l && caretOn && <span style={{ background: C.clay, color: C.clay }}>_</span>}
                  </div>
                );
              }
              const p = prog(f, l.start, l.start + 6, E.out);
              return (
                <div key={i} style={{ color: "#B9B2A6", opacity: p, transform: `translateY(${(1 - p) * 14}px)`, whiteSpace: "pre-wrap" }}>
                  {l.out}
                </div>
              );
            })}
          </div>
        </Panel>
      </Column>
    </AbsoluteFill>
  );
};

// ---------- chat: macro on the prompt as it types, send, pull back as the reply streams ----------
export const Chat: React.FC<SceneCtx<"chat">> = ({ scene, dur, S, G }) => {
  const f = useCurrentFrame();
  const inP = prog(f, 0, 12, E.out);
  const typeStart = 6;
  const perChar = Math.min(1.0, (dur * 0.3) / scene.prompt.length);
  const sent = typeStart + Math.ceil(scene.prompt.length * perChar) + 6;
  const replyWords = scene.reply.split(" ");
  const perWord = Math.min(3.5, (dur * 0.88 - sent - 8) / replyWords.length);
  const shownWords = Math.max(0, Math.floor((f - sent - 8) / perWord));
  const typed = f < sent ? scene.prompt.slice(0, Math.floor(Math.max(0, f - typeStart) / perChar)) : "";
  const bubbleP = prog(f, sent, sent + 12, E.out);
  const cam = push(f, 0, 1.12, sent - 4);
  const keys = [];
  for (let k = 0; k < scene.prompt.length; k += 3) keys.push(<Sfx key={k} at={typeStart + k * perChar} name="key" seed={k} volume={0.18} />);
  return (
    <AbsoluteFill>
      {keys}
      <Sfx at={sent} name="send" volume={0.55} />
      <Column S={S} gap={30}>
        <Label text={scene.label} g={G} S={S} />
        <Panel g={G} S={S} style={{ height: 900 * S, display: "flex", flexDirection: "column", transform: `translateY(${(1 - inP) * 140 * S}px) scale(${cam})`, transformOrigin: "50% 100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 * S, padding: `${26 * S}px ${34 * S}px`, borderBottom: `1px solid ${G.line}`, fontFamily: F.body, fontWeight: 700, fontSize: 36 * S }}>
            <div style={{ width: 22 * S, height: 22 * S, borderRadius: 99, background: C.clay }} />
            {scene.app ?? "AI Chat"}
          </div>
          <div style={{ flex: 1, padding: 36 * S, display: "flex", flexDirection: "column", gap: 28 * S, justifyContent: "flex-end", fontFamily: F.body, fontSize: 48 * S, lineHeight: 1.32 }}>
            {f >= sent && (
              <div style={{ alignSelf: "flex-end", maxWidth: "84%", background: C.clay, color: C.ink, fontWeight: 600, padding: `${20 * S}px ${28 * S}px`, borderRadius: `${30 * S}px ${30 * S}px ${8 * S}px ${30 * S}px`, opacity: bubbleP, transform: `translateY(${(1 - bubbleP) * 80 * S}px)` }}>
                {scene.prompt}
              </div>
            )}
            {shownWords > 0 && (
              <div style={{ display: "flex", gap: 20 * S, alignItems: "flex-start" }}>
                <Img src={BRAND.logo} style={{ width: 60 * S, borderRadius: 14 * S, flexShrink: 0 }} />
                <div>{replyWords.slice(0, shownWords).join(" ")}</div>
              </div>
            )}
          </div>
          <div style={{ margin: 26 * S, padding: `${22 * S}px ${28 * S}px`, borderRadius: 22 * S, border: `2px solid ${f < sent ? C.clay : G.line}`, fontFamily: F.body, fontSize: 44 * S, minHeight: 56 * S, opacity: f < sent ? 1 : 0.5 }}>
            {typed || <span style={{ opacity: 0.4 }}>Message…</span>}
            {f < sent && f > typeStart && <span style={{ color: C.clay }}>|</span>}
          </div>
        </Panel>
      </Column>
    </AbsoluteFill>
  );
};

// ---------- stat: one true number, huge, rolling to its value ----------
export const Stat: React.FC<SceneCtx<"stat">> = ({ scene, S, G, cue }) => {
  const f = useCurrentFrame();
  const at = cue(scene.at, 4);
  const p = prog(f, at, at + 30, E.out);
  const v = mix(0, scene.value, p);
  const txt = v.toLocaleString("en-US", { minimumFractionDigits: scene.decimals ?? 0, maximumFractionDigits: scene.decimals ?? 0 });
  const punch = 1 + 0.04 * hitPulse(f - (at + 28));
  return (
    <AbsoluteFill>
      <Sfx at={at} name="count" volume={0.4} />
      <Sfx at={at + 27} name="pop" volume={0.5} />
      <Column S={S} gap={24}>
        <Label text={scene.label} g={G} S={S} />
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 330 * S, lineHeight: 0.9, letterSpacing: "-0.05em", color: G.fg, fontVariantNumeric: "tabular-nums", transform: `scale(${punch})`, transformOrigin: "0% 60%", opacity: prog(f, at - 3, at + 3, E.smooth) }}>
          <span style={{ color: G.accent }}>{scene.prefix}</span>
          {txt}
          <span style={{ color: G.accent }}>{scene.suffix}</span>
        </div>
        <div style={{ height: 16 * S, borderRadius: 99, background: G.line, overflow: "hidden" }}>
          <div style={{ width: `${p * 100}%`, height: "100%", background: G.accent }} />
        </div>
        <HeroWords words={toWords(scene.label, undefined, (_, i) => at + 8 + i * 3)} size={84 * S} g={G} />
      </Column>
    </AbsoluteFill>
  );
};

// ---------- compare: before dims and strikes as after slams in ----------
const Check: React.FC<{ s: number; ok: boolean; color: string }> = ({ s, ok, color }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: s * 0.14 }}>
    {ok ? (
      <path d="M4 12.5 L10 18 L20 6" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" />
    )}
  </svg>
);

export const Compare: React.FC<SceneCtx<"compare">> = ({ scene, dur, S, vertical, G, cue }) => {
  const f = useCurrentFrame();
  const afterAt = cue(scene.after.at, Math.round(dur * 0.42));
  const bP = prog(f, 0, 12, E.out);
  const aP = prog(f, afterAt, afterAt + 12, E.out);
  const dim = prog(f, afterAt, afterAt + 10, E.smooth);
  const side = (label: string, items: string[], ok: boolean, p: number, start: number) => (
    <Panel
      g={G}
      S={S}
      style={{
        flex: 1,
        padding: 48 * S,
        opacity: ok ? Math.min(1, p * 1.5) : 1 - 0.55 * dim,
        transform: ok ? `translateX(${(1 - p) * 500 * S}px) rotate(${(1 - p) * 4}deg)` : `translateY(${(1 - p) * 160 * S}px) scale(${1 - 0.04 * dim})`,
        border: ok ? `4px solid ${C.ivory}` : undefined,
      }}
    >
      <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30 * S, letterSpacing: "0.14em", textTransform: "uppercase", color: ok ? C.clay : "#ffffff88", marginBottom: 18 * S }}>{label}</div>
      {items.map((it, i) => {
        const ip = prog(f, start + 4 + i * 4, start + 14 + i * 4, E.out);
        return (
          <div key={i} style={{ display: "flex", gap: 18 * S, fontFamily: F.display, fontWeight: 800, fontSize: 60 * S, lineHeight: 1.18, letterSpacing: "-0.02em", marginTop: 10 * S, opacity: ip, transform: `translateX(${(1 - ip) * 30}px)`, color: ok ? C.ivory : "#ffffff99" }}>
            <Check s={54 * S} ok={ok} color={ok ? C.clay : "#ffffff55"} />
            <span style={{ textDecoration: !ok && dim > 0.5 ? "line-through" : "none", textDecorationThickness: 5 * S }}>{it}</span>
          </div>
        );
      })}
    </Panel>
  );
  return (
    <AbsoluteFill>
      <Sfx at={0} name="slide" volume={0.4} />
      <Sfx at={afterAt} name="thud" volume={0.5} />
      <Column S={S} gap={30}>
        <Label text={scene.label} g={G} S={S} />
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 30 * S }}>
          {side(scene.before.label, scene.before.items, false, bP, 0)}
          {side(scene.after.label, scene.after.items, true, aP, afterAt)}
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ---------- list: a stem with a huge rotating slot (never a bullet wall) ----------
export const List: React.FC<SceneCtx<"list">> = ({ scene, dur, S, G, cue }) => {
  const f = useCurrentFrame();
  const n = scene.items.length;
  const starts = scene.items.map((it, i) => (i === 0 ? 2 : cue(it.at, Math.round(4 + (i * (dur - 16)) / n))));
  const cur = starts.filter((s) => f >= s).length - 1;
  return (
    <AbsoluteFill>
      {starts.map((s, i) => (
        <Sfx key={i} at={s - 1} name="switch" volume={0.4} />
      ))}
      <Column S={S} gap={30}>
        <Label text={scene.label} g={G} S={S} />
        {scene.stem && <HeroWords words={toWords(scene.stem, undefined, (_, i) => i * 3)} size={90 * S} g={{ ...G, fg: G.sub }} />}
        <div style={{ position: "relative", height: 200 * S }}>
          {scene.items.map((it, i) => {
            const enter = prog(f, starts[i], starts[i] + 8, E.out);
            const leave = i < n - 1 ? prog(f, starts[i + 1] - 1, starts[i + 1] + 5, E.in) : 0;
            if (f < starts[i] || leave === 1) return null;
            return (
              <div key={i} style={{ position: "absolute", inset: 0, fontFamily: F.display, fontWeight: 800, fontStyle: "italic", fontSize: 170 * S, lineHeight: 1, letterSpacing: "-0.04em", color: G.accent, whiteSpace: "nowrap", transformOrigin: "0% 60%", transform: `scale(${mix(1.3, 1, enter)}) translateY(${-leave * 120 * S}px)`, opacity: enter * (1 - leave) }}>
                {it.text}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16 * S }}>
          {scene.items.map((_, i) => (
            <div key={i} style={{ width: (i === cur ? 70 : 22) * S, height: 22 * S, borderRadius: 99, background: i <= cur ? G.accent : G.line }} />
          ))}
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ---------- cta: Mo lands, lockup holds; the final frame is the poster ----------
export const Cta: React.FC<SceneCtx<"cta">> = ({ scene, S, vertical, G }) => {
  const f = useCurrentFrame();
  const land = spr(f, 4, SPR.calm);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Sfx at={6} name="bell" volume={0.45} />
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 50 * S }}>
        <Mascot size={(vertical ? 420 : 380) * S} wave enterDelay={0} mood="happy" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", gap: 22 * S, opacity: land, transform: `translateY(${(1 - land) * 40}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 * S }}>
            <Img src={BRAND.logo} style={{ width: 110 * S, borderRadius: 24 * S }} />
            <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: 130 * S, color: G.fg, lineHeight: 1 }}>
              Agent <span style={{ color: G.accent }}>Mode</span>
            </div>
          </div>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 34 * S, letterSpacing: "0.1em", textTransform: "uppercase", color: G.sub }}>{scene.sub ?? scene.text}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SCENES = {
  hook: Hook,
  source: Source,
  statement: Statement,
  terminal: Terminal,
  chat: Chat,
  stat: Stat,
  compare: Compare,
  list: List,
  cta: Cta,
} as const;

/** Default ground per type: consecutive scenes alternate so no stretch is monotone. */
export const DEFAULT_GROUND = {
  hook: "ink",
  source: "clay",
  statement: "paper",
  terminal: "ink",
  chat: "paper",
  stat: "ink",
  compare: "ink", // never clay under subtitles: a clay active word on clay reads as black outline
  list: "paper",
  cta: "ink",
} as const;

