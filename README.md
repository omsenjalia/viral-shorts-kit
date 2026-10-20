# /video

**You found it. Now make it a Short.**

<p align="center">
  <img src="docs/demo.gif" width="320" alt="A 36-second Short made by /video from one article" />
  <br/><a href="docs/demo.mp4">▶ Watch it with sound</a>
</p>

`/video` is a Claude Code skill that turns any link (an article, a repo, a launch) into a cinematic, narrated YouTube Short: 3D shots, real-page b-roll, voiceover, subtitles, music and share copy included. One command, rendered with [Remotion](https://remotion.dev).

The Short above was made by `/video` from a single article.

## Use it

Paste a link:

```text
/video https://github.com/some/repo
```

Or just a topic:

```text
/video "Claude Code hooks"
```

Want it wide? Ask for long-form, or both:

```text
/video <link> --long
/video <link> --both
```

You get an `out/<slug>/` folder with the MP4, a thumbnail, contact sheets and `upload.md` (title, description, hashtags). It never posts anything; that part is yours.

## What's in a video

| Beat | Shot |
|---|---|
| Hook | The claim lands on the voice in the first second. Frame 0 is your thumbnail. |
| The news | A **real screenshot** of the page, crash-zoomed onto the headline, with the key phrase marked as it's spoken. |
| The idea | **3D extruded words** with bevels, rim light and a filmstrip. |
| A command | Terminal windows floating in **3D space**, the camera flying between them. |
| A prompt | A close-up on the prompt typing, then a pull back as the answer streams in. |
| Old vs new | Pain points strike off as they're named; the wins land in 3D. |
| Personality | **Mo**, a 3D mascot who talks while the voice speaks. |
| End card | Logo, a FOLLOW button and a poster frame. |

Word-synced subtitles, a local voiceover at Shorts pace, an original music bed and -14 LUFS mastering are built in.

## Install

`/video` runs inside this repo, so cloning is the install:

```bash
git clone https://github.com/omsenjalia/viral-shorts-kit && cd viral-shorts-kit
npm i
pip install -r requirements.txt
```

Grab the voice model (~330 MB, runs locally):

```bash
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..
```

Then open Claude Code in the folder and run `/video`.

<details>
<summary>Rebuild the demo Short yourself</summary>

```bash
node scripts/capture.mjs hyperframes-open-source https://www.noqta.tn/en/blog/heygen-hyperframes-html-to-mp4-ai-agent-video-2026
node scripts/build.mjs hyperframes-open-source
```
</details>

## Make it yours

- **Brand:** `brand-template/brand.ts` holds the colors and fonts, plus a logo, mascot and banner. It ships as *Agent Mode*; swap in yours.
- **Taste:** tell it what you think after each video ("hook too slow", "love the terminal"). It logs your verdict in `.claude/skills/video/references/lessons.md` and follows it from then on.
- **More shots:** 124 shot recipes live in `.claude/skills/video/shotcraft/`. Port one to `src/shots/<Name>.shot.tsx` and it's available instantly.

## How it works

`/video` owns the story: it researches the source, picks the angle, writes the script and maps every beat to a shot. Then it builds:
- the Kokoro voice, with Whisper word timing,
- the music,
- the Remotion render,
- the mastering.

Before you ever see the video, a fresh AI reviewer checks it and the fixes get made.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js 20+
- Python 3.10+
- FFmpeg on `PATH`

## What's in this repo

- `.claude/skills/video/` — the skill, craft rules, your lessons, the scene catalog
- `.claude/skills/video/shotcraft/` — the vendored [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) shot library
- `src/shots/` — the cinematic shots, one file each
- `scripts/` — voice, music, page capture and build
- `brand-template/` — brand tokens, logo, mascot and banner
- `episodes/` — one JSON script per video

## Credits

- Shot library and review method — [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) by Vincent Wei (Apache-2.0)
- Inspired by — [brag](https://github.com/latent-spaces/brag), [launch-video-kit](https://github.com/timscheuerai/launch-video-kit), [onetake](https://github.com/feitangyuan/onetake) and [cinetic](https://github.com/Leonxlnx/cinetic)
- Rendering — [Remotion](https://remotion.dev) (free for individuals and small teams; companies may need a [license](https://remotion.dev/license))
- Voice — [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) plus [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- Sound effects — [Kenney](https://kenney.nl/) (CC0); a few [Mixkit](https://mixkit.co/license/#sfxFree) effects are fetched at build time, not redistributed

Apache-2.0. Not affiliated with Anthropic, HeyGen or Remotion.

## Contributing

New shots, demo Shorts and ideas are welcome. Open an issue or a PR.

## Star History

<a href="https://www.star-history.com/?type=date&repos=omsenjalia%2Fviral-shorts-kit">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=omsenjalia/viral-shorts-kit&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=omsenjalia/viral-shorts-kit&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=omsenjalia/viral-shorts-kit&type=date&legend=top-left" />
 </picture>
</a>
