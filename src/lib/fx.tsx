// Shared visual + audio primitives used by every scene.
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BRAND, GROUNDS, Ground } from "../../brand-template/brand";
import { E, mix, prog } from "./anim";

type G = (typeof GROUNDS)[Ground];

export type SfxName =
  | "hit" | "thud" | "bell" | "pop" | "click" | "send" | "switch" | "slide" | "count" | "glitch" | "key";

const KEYS = ["001", "004", "007", "010", "013", "016"];

/** A sound placed on the frame its visual starts (entries sound 0-3f before first visible frame). */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number; seed?: number }> = ({
  at,
  name,
  volume = 0.6,
  seed = 0,
}) => {
  const file = name === "key" ? `sfx/key-${KEYS[seed % KEYS.length]}.wav` : `sfx/${name}.ogg`;
  return (
    <Sequence from={Math.max(0, Math.round(at))} layout="none">
      <Audio src={staticFile(file)} volume={volume} />
    </Sequence>
  );
};

export type HeroWord = { text: string; at: number; accent?: boolean; lead?: boolean };

/**
 * Full-frame hero words, each snapping in on its spoken word (launch grammar):
 * a group's lead word lands from 2.4x with a blur, the rest step in from 1.3x. Never bounces.
 * Accent words: italic in the ground's accent, or in a highlight box (`box`).
 */
export const HeroWords: React.FC<{
  words: HeroWord[];
  size: number;
  g: G;
  box?: boolean;
  align?: "left" | "center";
  color?: string;
}> = ({ words, size, g, box = false, align = "left", color }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: BRAND.fonts.display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: "-0.035em",
        color: color ?? g.fg,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.24,
        rowGap: size * 0.06,
      }}
    >
      {words.map((w, i) => {
        const p = prog(f, w.at, w.at + 8, E.out);
        const from = w.lead ? 2.4 : 1.3;
        const vis = f >= w.at;
        const boxP = prog(f, w.at + 2, w.at + 10, E.out);
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              opacity: vis ? (w.lead ? 1 : prog(f, w.at, w.at + 4, E.smooth)) : 0,
              transform: `scale(${mix(from, 1, p)})`,
              transformOrigin: align === "center" ? "50% 60%" : "0% 60%",
              filter: w.lead && p < 1 ? `blur(${(1 - p) * 14}px)` : undefined,
              fontStyle: w.accent && !box ? "italic" : "normal",
              // a boxed word reads in fg until its box is mostly drawn, so it is never dark on dark
              color: w.accent ? (box ? (boxP > 0.5 ? g.boxFg : g.fg) : g.accent) : undefined,
              padding: w.accent && box ? "0 0.12em" : undefined,
            }}
          >
            {w.accent && box && (
              <span
                style={{
                  position: "absolute",
                  inset: `${size * 0.04}px 0 ${size * 0.02}px`,
                  background: g.box,
                  transformOrigin: "left",
                  transform: `scaleX(${boxP})`,
                  zIndex: -1,
                }}
              />
            )}
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Split text into hero words: accent words marked, timed by `cue` or a stagger. */
export const toWords = (
  text: string,
  accent: string | undefined,
  timing: (word: string, i: number) => number,
  leadEvery = Infinity,
): HeroWord[] => {
  const acc = (accent ?? "").toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  return text.split(/\s+/).map((t, i) => ({
    text: t,
    at: timing(t, i),
    accent: acc.includes(t.toLowerCase().replace(/[^a-z0-9]/g, "")),
    lead: i === 0 || i % leadEvery === 0,
  }));
};

/** Small mono label above a block (brag's "ONE COMMAND"): structure, never meaning. */
export const Label: React.FC<{ text?: string; g: G; S: number; at?: number }> = ({ text, g, S, at = 0 }) => {
  const f = useCurrentFrame();
  if (!text) return null;
  const p = prog(f, at, at + 8, E.out);
  return (
    <div
      style={{
        fontFamily: BRAND.fonts.mono,
        fontWeight: 700,
        fontSize: 30 * S,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: g.accent,
        opacity: p,
        transform: `translateX(${(1 - p) * -20}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** Opaque UI surface with one soft shadow (no glass, no glow). */
export const Panel: React.FC<{ g: G; S: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  g,
  S,
  style,
  children,
}) => (
  <div
    style={{
      background: g.panel,
      color: g.panelFg,
      border: `1px solid ${g.panel === "#FFFFFF" ? "#00000014" : "#ffffff14"}`,
      borderRadius: 30 * S,
      boxShadow: "0 30px 90px rgba(0,0,0,.28)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);
