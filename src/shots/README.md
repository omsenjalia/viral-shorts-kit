# src/shots: shotcraft shots, ported for Agent Mode

Each shot is a **data-driven, narrated** version of a video-shotcraft demo, used as one scene in an episode.
Shotcraft is vendored at `.claude/skills/video/shotcraft/` (Apache-2.0):
- recipe cards: `references/shots/<cat>/<card>.md`
- tuned source: `demos/<cat>/<card>/*.tsx`
- taste rules: `references/aesthetic-rules.md`, `references/sound-design.md`

## Contract

1. **One file per shot:** `src/shots/<Name>.shot.tsx`, exporting `export const shot: ShotDef = { type, component, ground?, fullBleed? }`.
   It registers itself (`registry.ts` uses `require.context`). **Never edit shared files** (`Episode.tsx`, `Scenes.tsx`, `types.ts`, `Root.tsx`, `registry.ts`, `src/sc/*`). If you need a shared change, say so in your report.
2. **Props:** the component gets `SceneCtx` (`src/types.ts`):
   - `scene`: your JSON fields plus `narration`, `frames`, `captions`
   - `dur`: frames
   - `S`: 1 at 1080 px wide in vertical; `height/1080` in wide
   - `vertical`
   - `G`: the ground tokens
   - `cue(word, fallback)`: the scene-relative frame when that word is spoken

   Beats should land on spoken words via `cue`. Every field must have a sensible default, so a missing one never crashes.
3. **Both formats:** 1080×1920 (Shorts, main) and 1920×1080. Shotcraft demos are 1920×1080 with hardcoded coordinates, so you must re-lay them out for vertical. Don't crop or letterbox.
4. **Safe zones, vertical:**
   - The watermark sits at y 100–170.
   - **Subtitles sit at y 1200–1420.** Keep readable content out of that band, and out of y > 1600 (YouTube's UI).
   - The right edge x > 960 is covered by YouTube's buttons between y 900 and 1700.

   With `fullBleed: true` you own the full frame, so put the content mass in y 230–1150 (backgrounds can bleed everywhere).
5. **Look:** use `src/sc` (shotcraft's own `Look.tsx` / `Polish.tsx` / `PageCam2D.tsx` / lib, already re-skinned) with `LOOKS.agentmode` (dark ink + clay), `LOOKS.agentclay` (clay flood) or `LOOKS.agentpaper`. Use brand fonts only: `FONT.sans` (Inter Tight) and `FONT.mono`; the wordmark uses `BRAND.fonts.heading`. Replace shotcraft's brand and copy with the scene's data. Mo lives at `brand-template/Mascot.tsx`.
6. **Port, don't reinvent:** read the card in full, then the exact demo TSX. Keep its tuned easing, timings and "known pitfall" parameters. The quality bar only goes up.
7. **Sound:** use `<Sfx>` from `src/lib/fx.tsx` with the CC0 names in `public/sfx/LICENSE.md`. If a shotcraft sound (`.claude/skills/video/shotcraft/assets/audio/sfx/...`) clearly beats ours, copy it to `public/sfx/sc/` **only if its row in `assets/audio/ATTRIBUTION.md` has a verified Mixkit/CC0 source**, and add it to the table in `public/sfx/LICENSE.md` under a heading for your shot.
8. **Deterministic:** no `Math.random()` or `Date`, everything is a function of the frame. Never fade the whole shot out: the cut in `Episode.tsx` is the exit.

## Test

Write `out/lab/<name>.json` as `{ "scene": { "type": "<type>", "frames": 180, "narration": "...", "captions": [], ...fields } }`, then:

```bash
npx remotion still ShotLab out/lab/<name>-40.png --frame=40 --props=out/lab/<name>.json
npx remotion still ShotLabWide out/lab/<name>-w40.png --frame=40 --props=out/lab/<name>.json
npx remotion render ShotLab out/lab/<name>.mp4 --props=out/lab/<name>.json
```

To see subtitles, add captions like `{ "text": " word", "startMs": 400, "endMs": 700, "timestampMs": 400, "confidence": null }`. Look at stills from the start, the key beat, mid-camera-move and the end, at both aspect ratios. `npx tsc --noEmit` must pass.
