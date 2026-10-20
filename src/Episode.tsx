import { AbsoluteFill, Audio, CalculateMetadataFunction, Img, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, GROUNDS } from "../brand-template/brand";
import { Captions } from "./Captions";
import { E, mix, prog } from "./lib/anim";
import { DEFAULT_GROUND, SCENES } from "./scenes/Scenes";
import { SHOTS } from "./shots/registry";
import type { Scene, SceneCtx } from "./types";

export type EpisodeProps = {
  slug: string;
  scenes?: Scene[];
  voice?: string | null;
  music?: string | null;
};

// Reads the manifest written by scripts/voice.py: one voice track, scenes padded to whole frames.
export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => {
  const res = await fetch(staticFile(`episodes/${props.slug}/manifest.json`));
  if (!res.ok) throw new Error(`No manifest for "${props.slug}". Run: node scripts/build.mjs ${props.slug}`);
  const m = (await res.json()) as { scenes: Scene[]; voice?: string; music?: string };
  if (!m.voice) throw new Error(`Old manifest for "${props.slug}". Re-run: python scripts/voice.py ${props.slug}`);
  return {
    durationInFrames: m.scenes.reduce((sum, s) => sum + s.frames, 0),
    props: { ...props, scenes: m.scenes, voice: m.voice, music: m.music ?? null },
  };
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
const groundOf = (s: Scene) =>
  GROUNDS[s.ground ?? SHOTS[s.type]?.ground ?? (DEFAULT_GROUND as Record<string, keyof typeof GROUNDS>)[s.type] ?? "ink"];

/** The ground: a full-frame colour field with a slow brand bloom and a faint dot lattice for depth. */
const Ground: React.FC<{ g: (typeof GROUNDS)["ink"]; seed: number }> = ({ g, seed }) => {
  const f = useCurrentFrame();
  const x = 30 + Math.sin((f + seed * 40) / 70) * 18;
  const y = 25 + Math.cos((f + seed * 40) / 90) * 12;
  return (
    <AbsoluteFill style={{ background: g.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at ${x}% ${y}%, ${g.bloom}38, transparent 70%)` }} />
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${g.line} 2.5px, transparent 2.5px)`, backgroundSize: "54px 54px", backgroundPosition: `0 ${f * 0.5}px` }} />
    </AbsoluteFill>
  );
};

/**
 * One scene. The cut is the transition: the outgoing shot accelerates into the cut (push + blur on E.in)
 * and the incoming one lands already in flight (E.out), so velocity matches across every seam.
 */
export const SceneFrame: React.FC<{ scene: Scene; index: number; dur: number; vertical: boolean; offset: number; total: number; last: boolean }> = ({
  scene,
  index,
  dur,
  vertical,
  offset,
  total,
  last,
}) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const S = vertical ? width / 1080 : height / 1080;
  const G = groundOf(scene);
  const cue = (word: string | undefined, fallback: number) => {
    if (!word) return fallback;
    const w = norm(word);
    const hit = scene.captions.find((c) => norm(c.text) === w) ?? scene.captions.find((c) => norm(c.text).startsWith(w));
    return hit ? Math.round((hit.startMs / 1000) * BRAND.fps) : fallback;
  };
  // a ported shot (src/shots/*.shot.tsx) wins over the built-in scene of the same type
  const def = SHOTS[scene.type];
  const Comp = (def?.component ?? (SCENES as Record<string, unknown>)[scene.type]) as React.FC<SceneCtx>;
  if (!Comp) throw new Error(`Unknown scene type "${scene.type}"`);
  const fullBleed = def?.fullBleed ?? false;
  const inP = index === 0 ? 1 : prog(f, 0, 9, E.out);
  const outP = last ? 0 : prog(f, dur - 6, dur, E.in);
  const scale = mix(1.07, 1, inP) * mix(1, 1.08, outP);
  const blur = (1 - inP) * 10 + outP * 12;
  // the user's approved subtitle style: one look on every ground, on every scene but the end card
  const captions = scene.type !== "cta";
  const capColors = { fg: BRAND.colors.ivory, active: BRAND.colors.clay, stroke: BRAND.colors.ink };
  return (
    <AbsoluteFill>
      <Ground g={G} seed={index} />
      <AbsoluteFill style={{ transform: `scale(${scale})`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
        <AbsoluteFill
          style={
            fullBleed
              ? undefined
              : {
                  // title-safe stage; on Shorts it stays clear of the captions and YouTube's bottom UI
                  top: vertical ? 250 * S : 150 * S,
                  bottom: vertical ? 750 * S : 230 * S,
                  left: vertical ? 80 * S : 160 * S,
                  right: vertical ? 80 * S : 160 * S,
                  width: "auto",
                  height: "auto",
                }
          }
        >
          <Comp scene={scene as never} dur={dur} S={S} vertical={vertical} G={G} cue={cue} />
        </AbsoluteFill>
      </AbsoluteFill>
      {/* subtitles sit outside the camera so they never blur or push at a cut */}
      {captions && <Captions captions={scene.captions} top={vertical ? `${1200 * S}px` : "83%"} fontSize={(vertical ? 84 : 64) * S} colors={capColors} />}
      {/* chrome stays still through the push; the end card has its own lockup */}
      {scene.type !== "cta" && <div style={{ position: "absolute", top: (vertical ? 120 : 64) * S, left: (vertical ? 80 : 160) * S, display: "flex", alignItems: "center", gap: 14 * S, fontFamily: BRAND.fonts.body, fontWeight: 700, fontSize: 32 * S, color: G.fg, opacity: 0.85 }}>
        <Img src={BRAND.logo} style={{ width: 50 * S, borderRadius: 12 * S }} />
        {BRAND.name}
      </div>}
      {vertical && <div style={{ position: "absolute", top: 0, left: 0, height: 10 * S, width: `${((offset + f) / total) * 100}%`, background: G.accent }} />}
    </AbsoluteFill>
  );
};

export const Episode: React.FC<EpisodeProps> = ({ scenes, voice, music }) => {
  const { width, height, durationInFrames } = useVideoConfig();
  const vertical = height > width;
  if (!scenes) return null;
  const offsets = scenes.map((_, i) => scenes.slice(0, i).reduce((a, s) => a + s.frames, 0));
  return (
    <AbsoluteFill>
      {voice && <Audio src={staticFile(voice)} />}
      {music && (
        <Audio
          src={staticFile(music)}
          // bed sits under the voice; the ending subtracts
          volume={(f) => 0.14 * (1 - prog(f, durationInFrames - 45, durationInFrames - 4, E.smooth))}
        />
      )}
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={scene.frames}>
            <SceneFrame scene={scene} index={i} dur={scene.frames} vertical={vertical} offset={offsets[i]} total={durationInFrames} last={i === scenes.length - 1} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
