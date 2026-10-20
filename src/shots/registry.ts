// Shot registry: every `src/shots/*.shot.tsx` registers itself, so shots can be added in parallel
// without editing a shared file. Each file exports `shot: ShotDef`. A shot with the same `type` as a
// built-in scene (src/scenes/Scenes.tsx) replaces it.
import type { Ground } from "../../brand-template/brand";
import type { SceneCtx } from "../types";

export type ShotDef = {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<SceneCtx<any>>;
  /** Default colour field (the shot may draw its own full-frame stage on top). */
  ground?: Ground;
  /** true: draws over the whole frame (keep content out of the subtitle band); false: rendered inside the title-safe stage. */
  fullBleed?: boolean;
};

// webpack's require.context (Remotion bundles with webpack)
declare const require: {
  context(dir: string, deep: boolean, re: RegExp): { keys(): string[]; (k: string): { shot?: ShotDef } };
};

const ctx = require.context("./", false, /\.shot\.tsx$/);
export const SHOTS: Record<string, ShotDef> = {};
for (const k of ctx.keys()) {
  const def = ctx(k).shot;
  if (def) SHOTS[def.type] = def;
}
