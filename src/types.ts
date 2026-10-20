import type { Caption } from "@remotion/captions";
import type { GROUNDS, Ground } from "../brand-template/brand";

// A word in the narration; the visual beat lands when that word is spoken.
type At = { at?: string };

export type SceneSpec =
  | { type: "hook"; text: string; accent?: string; mood?: Mood }
  | { type: "source"; publisher: string; headline: string; date?: string; accent?: string }
  | { type: "statement"; fragments: ({ text: string } & At)[]; accent?: string }
  | { type: "terminal"; title?: string; lines: ({ cmd?: string; out?: string } & At)[] }
  | { type: "chat"; prompt: string; reply: string; app?: string }
  | ({ type: "stat"; value: number; prefix?: string; suffix?: string; decimals?: number; label: string } & At)
  | { type: "compare"; before: { label: string; items: string[] }; after: { label: string; items: string[] } & At }
  | { type: "list"; stem?: string; items: ({ text: string } & At)[] }
  | { type: "cta"; text: string; sub?: string };

export type Mood = "happy" | "shock" | "think";

// Ported shots (src/shots/*.shot.tsx) define their own fields; they validate them themselves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ShotSpec = { type: string } & Record<string, any>;

// Optional on every scene: the colour field it sits on, and a small mono label (brag's "ONE COMMAND").
export type SceneBase = {
  ground?: Ground;
  label?: string;
  narration: string;
  frames: number;
  durationMs: number;
  captions: Caption[];
};
export type Scene = (SceneSpec | ShotSpec) & SceneBase;

export type SceneCtx<T extends string = SceneSpec["type"]> = {
  scene: T extends SceneSpec["type"] ? Extract<SceneSpec, { type: T }> & SceneBase : ShotSpec & SceneBase;
  dur: number; // frames
  S: number; // type scale: 1 at 1080-wide vertical
  vertical: boolean;
  G: (typeof GROUNDS)[Ground];
  /** Frame (scene-relative) when `word` is first spoken, else `fallback`. */
  cue: (word: string | undefined, fallback: number) => number;
};
