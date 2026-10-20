// House motion system. All motion comes from here so videos read as one brand.
// Numbers are cinetic's measured defaults, converted to 30 fps.
import { Easing, interpolate, spring } from "remotion";
import { BRAND } from "../../brand-template/brand";

const FPS = BRAND.fps;

export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // arrivals: fast then settle
  outSoft: Easing.bezier(0.22, 1, 0.36, 1), // type and gentle settles
  in: Easing.bezier(0.7, 0, 0.84, 0), // exits: slow then fast
  exit: Easing.bezier(0.55, 0.055, 0.675, 0.19), // exits into a cut
  inOut: Easing.bezier(0.87, 0, 0.13, 1), // whips, wipes
  smooth: Easing.bezier(0.65, 0, 0.35, 1), // fades and drifts
  ui: Easing.bezier(0.4, 0, 0.2, 1), // small UI changes
  linear: Easing.linear,
};

/** 0..1 progress of frame f between a and b, eased and clamped. Always pass the curve. */
export const prog = (f: number, a: number, b: number, ease: (t: number) => number) =>
  interpolate(f, [a, b], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Log-space mix for scale/zoom so it feels like constant speed. */
export const lmix = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t));

// Springs: critically damped by default. Overshoot only on a true landing, max 2 per video.
export const SPR = {
  calm: { damping: 16, stiffness: 64, mass: 1 }, // the only spring for type
  firm: { damping: 24, stiffness: 140, mass: 1 }, // UI arrivals
  soft: { damping: 26, stiffness: 120, mass: 1 }, // panels, cards
  land: { damping: 14.5, stiffness: 200, mass: 1 }, // a real landing (mascot, logo)
};

export const spr = (f: number, start: number, config: typeof SPR.calm) => {
  const v = spring({ frame: f - start, fps: FPS, config });
  return Math.abs(1 - v) < 0.01 ? 1 : v;
};

/** Attack-decay envelope for punches and ticks: peaks ~1f after the cue, gone by ~16f. */
export const hitPulse = (t: number, attack = 2, tau = 5) => {
  const u = (t * 60) / FPS;
  if (u <= 0 || u > attack + 6 * tau) return 0;
  return u < attack ? Math.sin((u / attack) * (Math.PI / 2)) : Math.exp(-(u - attack) / tau);
};

// Pace (30 fps frames): calm-ish, tuned for narrated Shorts.
export const PACE = {
  wordDur: 16, // one word's rise
  stagger: 4, // between words in a fragment
  exitDur: 10, // whole fragment leaves together
  fade: 6, // fades run ~10-14f at 60fps
};

/** Seeded random in [0,1), deterministic per render. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
