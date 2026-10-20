// Agent Mode brand tokens: the single source of truth for every video.
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/InterTight";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import logo from "./logo.svg";

const serif = loadSerif("normal", { weights: ["600", "700"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["500", "600", "700", "900"], subsets: ["latin"] });
const display = loadDisplay("normal", { weights: ["800", "900"], subsets: ["latin"] });
loadDisplay("italic", { weights: ["800", "900"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] });

const colors = {
  // Claude-inspired warm palette (our own tokens, not Anthropic's brand assets)
  clay: "#D97757", // primary accent, mascot body
  clayDark: "#B85C3E",
  ivory: "#FAF9F5", // main text
  oat: "#E3DACC", // secondary text
  ink: "#141413", // background
  slate: "#3D3D3A", // panels, grid
  paper: "#F3EEE4", // light ground
  sky: "#6A9BCC", // rare highlight
  olive: "#788C5D", // success / "do this"
};

/**
 * Grounds: full-frame colour fields. Scenes switch ground on hard cuts so no stretch is monotone.
 * fg = type, sub = secondary, accent = the one element that matters, box = highlight box behind key words,
 * panel = UI surface, bloom = soft drifting brand light.
 */
export const GROUNDS = {
  ink: { bg: colors.ink, fg: colors.ivory, sub: "#B9B2A6", accent: colors.clay, box: colors.clay, boxFg: colors.ink, panel: "#1F1E1C", panelFg: colors.ivory, line: "#ffffff14", bloom: colors.clay },
  clay: { bg: colors.clay, fg: colors.ink, sub: "#4A2414", accent: colors.ivory, box: colors.ink, boxFg: colors.clay, panel: colors.ink, panelFg: colors.ivory, line: "#00000022", bloom: "#F6C2A8" },
  paper: { bg: colors.paper, fg: colors.ink, sub: "#6E665B", accent: colors.clayDark, box: colors.clay, boxFg: colors.ink, panel: "#FFFFFF", panelFg: colors.ink, line: "#0000001a", bloom: colors.clay },
};
export type Ground = keyof typeof GROUNDS;

export const BRAND = {
  name: "Agent Mode",
  logo,
  fps: 30,
  colors,
  fonts: {
    heading: serif.fontFamily, // Source Serif 4: the wordmark and lockups only
    display: display.fontFamily, // Inter Tight 800-900: hero words in videos (italic for the accent word)
    body: sans.fontFamily, // Inter: UI text + captions
    mono: mono.fontFamily, // JetBrains Mono: terminals, code, small labels
  },
};
