// ShotLab: preview one scene/shot in the real episode frame (ground, subtitles, watermark) without a voice.
// Render a still:  npx remotion still ShotLab out/lab.png --frame=40 --props=path/to/lab.json
// lab.json = { "scene": { "type": "...", "frames": 180, "narration": "...", "captions": [...], ...fields } }
// Captions may be [] (then no subtitles); `cue()` falls back to each beat's default frame.
import { AbsoluteFill, CalculateMetadataFunction } from "remotion";
import { SceneFrame } from "./Episode";
import type { Scene } from "./types";

export type ShotLabProps = { scene: Scene };

export const shotLabDefault: ShotLabProps = {
  scene: {
    type: "statement",
    fragments: [{ text: "Shot" }, { text: "lab." }],
    narration: "Shot lab.",
    frames: 90,
    durationMs: 3000,
    captions: [],
  } as unknown as Scene,
};

export const shotLabMetadata: CalculateMetadataFunction<ShotLabProps> = ({ props }) => ({
  durationInFrames: Math.max(1, props.scene.frames ?? 90),
});

export const ShotLab: React.FC<ShotLabProps> = ({ scene }) => (
  <AbsoluteFill>
    <SceneFrame scene={{ ...scene, durationMs: scene.durationMs ?? 0, captions: scene.captions ?? [] }} index={0} dur={scene.frames} vertical offset={0} total={scene.frames} last />
  </AbsoluteFill>
);

export const ShotLabWide: React.FC<ShotLabProps> = ({ scene }) => (
  <AbsoluteFill>
    <SceneFrame scene={{ ...scene, durationMs: scene.durationMs ?? 0, captions: scene.captions ?? [] }} index={0} dur={scene.frames} vertical={false} offset={0} total={scene.frames} last />
  </AbsoluteFill>
);
