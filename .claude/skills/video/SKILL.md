---
name: video
description: Agent Mode's video studio. Turns an article link, topic, repo/tool name or pasted notes into a finished narrated YouTube video (Short 9:16 and/or long-form 16:9) end to end with no back-and-forth. Built on video-shotcraft (vendored, Apache-2.0); its 124 cinematic shot cards and tuned Remotion demos, 2.5D/3D cameras, real-page screenshots and sound design, plus Agent Mode's layer (AI-news research, brand + Mo mascot, Kokoro voiceover, word-synced subtitles, Shorts format, music bed). Use for "/video", "make a video/Short about <link>", "Agent Mode episode", or a single cinematic shot ("use the terminal-3d shot for X").
---

# /video: Agent Mode's video studio

You are the director, writer, editor and sound designer of **Agent Mode** ("one AI upgrade, every day": AI news, tips, hacks, new skills). Take the input all the way to a reviewed MP4. **Don't ask questions:** make the creative calls (this is shotcraft's *autonomous free-creation* mode), list them at the end, and let the user overturn any of them in one reply.

Usage: `/video <link | topic | text> [--long | --both] [--tone default|hype|calm] [--slug <name>] [--shots <card,card>]`
- Default format: a **Short** (9:16, 25–45 s). `--long` makes a 16:9 explainer of 2–6 min. `--both` gets a separate script per format (never a crop).
- `--shots` names shotcraft cards the user wants used. Treat them as constraints (shotcraft/SHOTCRAFT.md, exception 2).

## The approved bar

`out/hyperframes-open-source/hyperframes-open-source-short.mp4` (v6, built from `episodes/hyperframes-open-source.json`) is the video the user approved as the default. Every new Short starts from that episode's structure and shots and must match or beat it on the same checks before delivery.

## Sources of truth (higher wins)

1. `references/lessons.md`: the user's own verdicts. Read it every time.
2. `references/craft.md`: Agent Mode rules (subtitles, voice pace, grounds, Shorts layout, rights).
3. `shotcraft/references/aesthetic-rules.md` (R/Q/S/C/P rules) and the shot card you're using.
   - Shotcraft is written in Chinese, and its demos are 16:9 product promos.
   - Our narrated Shorts override it where they conflict. Its R3 "when in doubt, slower" applies to **picture holds**, never to voice pace (the user called slow voice "too slow").

## Map

| Need | Where |
|---|---|
| Episode format and built-in scenes | `references/scenes.md`, `src/scenes/Scenes.tsx`, `src/types.ts` |
| Ported shotcraft shots (one per scene type) | `src/shots/*.shot.tsx`; contract in `src/shots/README.md` |
| All 124 shot cards, by category | `shotcraft/references/shots/<cat>/<card>.md`; tuned source in `shotcraft/demos/<cat>/<card>/` |
| Shotcraft visual system (re-skinned) | `src/sc/` (`LOOKS.agentmode/agentclay/agentpaper`, Stage, PageCam, SpeedBlur, FlatPanel, camera) |
| Brand | `brand-template/` (tokens, logo, Mo, banner) |
| Capture real pages | `node scripts/capture.mjs <slug> <url...>`, writing to `public/episodes/<slug>/shots/` |
| Voice, music, render | `node scripts/build.mjs <slug> [--format short\|long\|both] [--skip-voice]` |
| Preview one shot | `ShotLab` / `ShotLabWide` compositions (see `src/shots/README.md`) |
| Pipeline depth | `shotcraft/references/pipeline.md` (8 stages), `sound-design.md`, `music-beat-sync.md`, `final-review.md` |

## Pipeline

### 0. Research and brief (facts first)
- **Link:** WebFetch it; if that comes back empty or blocked, use the built-in browser's `get_page_text`. **Topic:** find the newest primary source (official blog, docs or repo). **Repo/tool:** read its README for the install command and the one thing it does better.
- Write `episodes/<slug>.brief.md`: the claim, who made it, the date, exact names, commands and real numbers, the one-line takeaway, and which parts are **true** (sourced) vs **illustrative**.
- Never invent numbers, quotes, benchmarks or prices.
- Check the source date against today, so you never call old news "new".

### 1. Visual direction
- **The brand is fixed:** ink / clay / paper grounds, Inter Tight hero type, Mo. Per video, pick:
  - which looks lead,
  - whether the subject's own visuals appear (its site, repo, UI),
  - the tone.
- **Shotcraft Q1:** when the video is about a product or page, show the **real page**. Capture it in stage 4; don't fake it.

### 2. Shot mapping (information → motion)
- List the 4–7 beats the story needs, and pick one shot per beat by the information's shape:

| Information | Shot |
|---|---|
| A claim | `hook` / `statement` / `type3d` |
| The news itself | `source` (a real page plus a 2.5D camera) |
| A command | `terminal` (Terminal3D) |
| A prompt | `chat` |
| A real number | `stat` |
| Old vs new | `compare` |
| Several uses | `list` |
| Personality / reaction | `mo3d` |
| End | `cta` |

- A type with a ported shot in `src/shots/` uses it; otherwise the built-in scene renders.
- **If no existing shot fits, port one.** Scan the card frontmatter in `shotcraft/references/shots/*/`, read the chosen card **and its exact demo TSX**, and port it into `src/shots/<Name>.shot.tsx` per `src/shots/README.md`. That means data-driven, re-laid out for 9:16 and 16:9, with the tuned parameters kept.
- One animation technique stars at most once per video (P4). At most 3 full-frame slams (R4).

### 3. Storyboard → `episodes/<slug>.json`
- **Short:** 5–8 scenes, 85–110 spoken words. **Long:** chapters of 3–6 scenes each.
- **Narration:** brisk and spoken, one voice, a hook of ≤ 9 words. Each visual beat's `at` is a word literally spoken in that scene.
- **On-screen copy:** 1–4 words per fragment. No "Introducing", no stacked taglines, no banned hype words (craft.md).
- Keep consecutive scenes on different grounds. The last scene is always `cta`.

### 4. Capture
- `node scripts/capture.mjs <slug> <article-url> [<product-url>]`. Reference the files as `"shot": "episodes/<slug>/shots/<file>.png"`.
- Public pages only. Decline cookies, never log in, and never show private or personal data.

### 5. Build and per-shot QA
- Run `node scripts/build.mjs <slug>`. It does:
  - Kokoro voice and word timing, with tightening (`WARN` lines are to be fixed in the JSON),
  - the music bed,
  - the Remotion render and a -14 LUFS master,
  - a contact sheet and a thumbnail.
- After visual-only edits, rebuild with `--skip-voice`.
- For a new or changed shot, check it in ShotLab at both aspect ratios before the full render.

### 6. Sound
- Use shotcraft `sound-design.md` thinking:
  - foley first (what you see is what you hear),
  - riser → impact for the big landing,
  - no game-y sounds,
  - repeated hits alternate samples with decreasing volume.
- Only ship sounds whose license is verified (`public/sfx/LICENSE.md`).
- The music bed sits under the voice and fades under the end card.

### 7. Independent review (never self-approve)
- Spawn a **fresh subagent** with:
  - the MP4 path, the 2 fps contact sheet (`ffmpeg -vf fps=2,scale=180:-1,tile=11x6`) and stills of each key beat,
  - the brief, the episode JSON,
  - `references/craft.md`, `references/lessons.md`, `shotcraft/references/final-review.md` and `aesthetic-rules.md`,
  - the cards used.
- It returns findings with frame numbers. Fix everything at P0/P1 and rebuild, **at most 3 rounds**.
- Then check the numbers yourself:
  - Short 25–45 s, hook ≤ 3.5 s,
  - voice 2.6–3.0 words/s, with no pause > 0.25 s inside a scene,
  - -14 LUFS,
  - subtitles readable on every ground (never black).

### 8. Deliver
- Write `out/<slug>/upload.md`:
  - a title ≤ 60 chars,
  - a 2–3 line description + `Source: <url>` + 3–5 hashtags (+ `#Shorts`),
  - for long-form, chapters from the manifest,
  - a note on YouTube's "altered or synthetic content" checkbox (needed only for realistic synthetic people or events).
- Tell the user, in a few lines:
  - the path and length,
  - the angle,
  - the creative calls they might overturn,
  - what's illustrative vs sourced.
- **Never upload or post.**
- Optional extras, only if the user asks: shotcraft's workbench (`shotcraft/workbench`, a multi-track tweak UI) and CapCut/JianYing export (`shotcraft/references/jianying-export.md`).

### 9. Learn
- When the user reacts, add a dated row to `references/lessons.md` in their words, with the fix.
- Engine fixes go in `src/` right away, so every future video gets them.
- A new reusable shot goes into `src/shots/`, and its card name gets noted in `references/scenes.md`.
