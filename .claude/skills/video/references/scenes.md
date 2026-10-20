# Episode JSON and scene catalog

`episodes/<slug>.json`. Each scene's length comes from its narration, so never set durations by hand.
Built-in scenes are in `src/scenes/Scenes.tsx`. **Ported shotcraft shots in `src/shots/*.shot.tsx` replace the built-in scene of the same type** (hook, source, terminal, chat, cta) and add new types (type3d, mo3d). Types are in `src/types.ts`.

```json
{
  "title": "Human title for upload.md",
  "source": { "name": "Publisher: article title", "url": "https://…" },
  "music": "auto",
  "engine": "kokoro",
  "scenes": [ { "type": "...", "narration": "...", "...": "..." } ]
}
```

- **`music`:** `"auto"` is the original generated bed. A file name uses `brand-template/music/<file>` (a YouTube Audio Library track, say). `"none"` means no music.
- **Every scene also takes** `"label"` (a small mono label above the block, e.g. "One command", ≤ 3 words) and `"ground"` (`ink` | `paper`; defaults follow the approved v6: hook, source, terminal, compare, cta on ink; type3d, chat, mo3d on paper). **Never use `clay` under subtitles** (a clay active word on clay reads as black). Keep consecutive grounds different where you can.
- **Voice:** Kokoro (local, voice am_fenrir, speed 1.15) with faster-whisper word timing. `"engine": "edge"` falls back to edge-tts.
- **`at`:** a word spoken in that scene's narration. The beat lands when it's said. Matching ignores case and punctuation, then falls back to prefix matching ("frame" matches "frames").

## Scene types

| Type | Use when | Fields | Notes |
|---|---|---|---|
| `hook` | Always first. | `text` (≤ 6 words), `accent` (the slam word), `mood` | **HookSlam shot** (lead-word-zoom-assemble + score-slam). The lead word owns the frame at frame 0 (the thumbnail), then words push into place on their cues and the accent slams in with the video's one full-frame impact. Narration ≤ 3.5 s. |
| `source` | It's news: who announced what. | `shot` (`episodes/<slug>/shots/<file>.png` from `scripts/capture.mjs`), `url`, `publisher`, `headline`, `date`, `accent`, `focus` (`"h1"` or `[x,y,w,h]`), `hideDate` (blur the page date for older news) | **NewsPage shot** (shotcraft crash-zoom-punch). The real article in a browser window: corner brackets lock the headline, a crash zoom, and the accent phrase marked as it's spoken. Without `shot`, the same camera runs on a recreated page. |
| `statement` | A claim that is the idea (a mechanism in 3 beats, a rule). | `fragments` [{`text` 1–4 words, `at`}] (2–4 of them), `accent` (italic accent word) | A huge stacked build: the first line shows on frame 0, and the others snap in on their words. ≤ 25% of scenes. |
| `terminal` | Any command, CLI or install. | `title`, `lines` [{`cmd`} or {`out`}, optional `at`], `tools` [{`name`, `at`}] (chips in the lower band) | **Terminal3D shot.** Each `cmd` is a window in 3D space; the camera flies between them (2–3 windows) or pushes and orbits (1). Human typing rhythm, spinner → ✓ output. |
| `chat` | A prompt and an AI answer. | `app`, `prompt` (≤ 70 chars), `reply` (≤ 25 words, split into sentences), `artifact` {`name`, `at`} (a file tile in the lower band) | **ChatPrompt shot** (document-typewriter-reveal). An oblique close-up on the prompt typing, a send, a pull back, and the reply streaming block by block. The reply is illustrative unless quoted. |
| `stat` | A real number from the source. | `value`, `prefix`, `suffix`, `decimals`, `label` (≤ 5 words), `at` (the word where the number is said) | It counts up and lands with a punch. Never use invented numbers. |
| `compare` | Old way vs new way, without vs with. | `before` {`label`, `items` (≤ 3)}, `after` {`label`, `items` (≤ 3), `at`} | **CompareStack shot.** Old rows strike off as they are named, new rows land in 3D on their spoken words, with a camera push and an OLD/NEW tracker in the lower band. Items ≤ 4 words. |
| `list` | Several uses, steps or picks. | `stem` (e.g. "Use it for"), `items` [{`text` 1–3 words, `at`}] (3–5) | A rotating slot with progress dots, never a bullet wall. |
| `type3d` | A 1–4 word claim that deserves weight (the idea in one line). | `words` [{`text`, `at`}], `accent`, `film` {`at`} (a filmstrip in the lower band) | **WebGL** extruded Inter Tight words standing up on their cue; the camera pulls back per word. About 1 s/frame to render. |
| `mo3d` | Personality, reaction, the takeaway in Mo's voice. | `text`, `accent`, `mood` (`happy`/`shock`/`think`), `pose` (`present`/`wave`/`point`) | **WebGL** 3D Mo with a studio light, talking while words are spoken. Once per video. |
| `cta` | Always last. | `text`, `sub` | **OutroLockup shot.** A cut ring collapses into the logo, the wordmark slides in, Mo pops up waving, and it holds ≥ 1 s as a poster. No captions. |

## Short template (about 35–42 s)

`hook → source (real page) → type3d or terminal → chat or list → compare or stat → mo3d → cta`

Capture the source first: `node scripts/capture.mjs <slug> <article-url> [<product-url>]`.

## Long-form template (2–6 min)

`hook → source → [chapter: statement → 3–6 show scenes] × 3–6 → recap list → cta`

For long-form, write the narration as a calm explainer (`--tone calm`). A scene can run 10–20 s when its visual has enough beats (a terminal with 4 lines, a list of 5).

## Worked example: the approved default (v6)

`episodes/hyperframes-open-source.json` is the **user-approved reference** ("v6 looks great. Lock this in as the /video default."): 36 s, 8 scenes, `hook → source (real page) → type3d → terminal → chat → compare → mo3d → cta`. Start every new Short from its structure, pacing and field usage; change the content, not the craft.
