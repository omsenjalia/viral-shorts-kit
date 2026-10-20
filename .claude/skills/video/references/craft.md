# Craft: what makes these videos good

This is distilled from studying the best open-source launch-video kits and their actual example films, frame by frame:
- **latent-spaces/brag:** full-frame color floods, huge heavy type, terminals at full width.
- **timscheuerai/launch-video-kit:** hero words cut on the voice, backgrounds that change, stitched voice timing, -14 LUFS.
- **feitangyuan/onetake:** macro moments, a camera that chases, every beat carrying into the next.
- **Leonxlnx/cinetic:** the AI-video tell catalogue.

It's adapted to a **narrated** AI-news channel. The engine enforces most of this, in `src/lib/anim.ts`, `src/lib/fx.tsx`, `src/scenes/Scenes.tsx` and `src/Episode.tsx`.

> The user's verdict on v1 and v2 was "too basic", "the screen feels empty" and "the audio is too slow and stutters". Every rule below exists to prevent those.

## Story
- **Problem → turn → payoff, not feature, feature, logo.** The viewer should be able to repeat one sentence afterwards.
- **The hook is everything.** The claim is on screen by 1 s and spoken by 2.5 s. Frame 0 is already composed. No "Introducing", no logo first, no rhetorical question.
- **Clear to a stranger:** what it is, who it's for, how to get it (the command, the link).
- **Specific.** Use the source's own names, commands and numbers. Banned phrases: "seamless", "unlock", "supercharge", "game-changer", "the future of", "revolutionary", "AI-powered".
- **Show the thing.** A command goes in a terminal, a prompt in a chat, a number in a counter. The voice leads, and the picture illustrates it word by word: when the voice says "tagged", something gets tagged.

## Fill the frame (the "screen feels empty" fix)
- **Full-frame color grounds:** `ink` (near-black), `clay` (the brand orange flood) and `paper` (warm light). Consecutive scenes switch ground on the cut, so no stretch longer than a few seconds is monotone. The defaults are set per scene type (`DEFAULT_GROUND`), and a scene can override with `"ground"`.
- **Hero words are huge:** Inter Tight 800 at 160–180 px on a 1080-wide Short, left-aligned, tight leading and tracking, edge to edge inside an 80 px margin. Each word snaps in on its spoken word: the first from 2.4× with a blur, the rest from 1.3×.
- **Emphasis:** the accent word sits in a highlight box (brag's "let's [brag]"), or is italic in the accent color. Use one key word per line.
- **Small mono labels above blocks** give structure (`"label": "One command"`). They're never the message.
- **UI at close range:** panels span the full width (about 920 px), text is ≥ 44 px, and the camera pushes into whatever is being said. Include one **macro moment** per video, like the command typing at 1.16× with the camera close.
- **A soft brand bloom drifts** on every ground, with a faint dot lattice for depth. Not neon, not glass.

## Cuts and motion
- **The cut is the transition.** Nothing fades out. The outgoing shot accelerates into the cut (push to 1.08× plus blur on `E.in`), and the incoming one lands already in flight (from 1.07× on `E.out`). Velocity matches across every seam.
- **Arrivals decay, exits accelerate.** Type never bounces. Overshoot only on true landings, at most 2 (Mo, the end lockup).
- **Camera:** every move is motivated by the voice. Pushes take 0.6 s; pull back when the next thing arrives. Vary the verbs (push, pull back, slide).
- **One hero motion at a time.** Mo appears in the hook (big, reacting) and the CTA, not in every scene.

## Voice (the "too slow / stutters" fix)
- **One stitched track** (`scripts/voice.py`): each scene is synthesized, then leading and trailing silence are trimmed, pauses inside a line shrink to ≤ 0.22 s, and a 0.16 s breath is added between scenes. Each scene is padded to a whole video frame, so picture and voice never drift. Never play per-scene clips; restarting clips is what stutters.
- **Pace 2.6–3.0 words/s.** The default is Andrew at +20%. If the lint says it's slow, cut words before speeding the voice up.
- **One voice for the whole video.**
- **Narration is spoken, not read:** short sentences, no stacked clauses. The hook is ≤ 9 words.

## Sound
- **Music bed** (`scripts/music.py`, original and royalty-free) at 0.14 under the voice. The ending subtracts: it fades under the end card.
- **CC0 effects** (`public/sfx`) sit on the frame their visual starts. Score discrete state changes (send, copied, slam, land, count), not every word or cut. Typing is thinned to every 3rd key and kept quiet.
- **Master to -14 LUFS, -1.5 dBTP** (`build.mjs` runs loudnorm). Quieter than that reads as weak next to other Shorts.

## Subtitles (the user's approved style; never change it)
- **On every scene except the end card.** Big uppercase Inter 900; ivory fill with a thick ink outline (fontSize/7) and a solid ink drop shadow; the word being spoken is clay.
- **The same colors on every ground.** Never ink text on a light ground, and never an ink active word on clay ("they are turning black").
- **Drawn by the episode frame, outside the camera** (no blur or push at cuts), at y ≈ 1200 on Shorts and 83% on wide. Shots keep their readable content out of that band.

## Rights and truth
- **The original music and the Kenney CC0 effects are safe to monetize.** No commercial songs.
- **Recreate UI and article cards; don't screenshot them.** No real private data, no real faces, no third-party logos beyond naming the product.
- **Mark illustrative bits** (sample prompts, outputs) as illustrative in the report.
- **Mo is our own mascot.** Never use Claude's mascot or Anthropic logos.

## Review checklist (2 fps contact sheet + stills at key beats)
1. **Frame 0:** it reads as a thumbnail (big hook words, ink ground).
2. **Grounds alternate:** no two consecutive scenes on the same ground unless it's intentional.
3. **No empty stage:** the content mass sits in the middle of the frame, and no scene opens blank.
4. **Readable on a phone:** at 180 px per frame on the sheet, you can still read hero words and the panels' main text.
5. **No collisions:** a pushed panel doesn't overlap the watermark, captions don't cover content, and highlight boxes show their word.
6. **Facts** match the source, and nothing is time-stale.
7. **Numbers:** Short 25–45 s, hook ≤ 3.5 s, pace ≥ 2.6 words/s, no voice pause > 0.25 s inside a scene, -14 LUFS.
8. **The final frame is the lockup.**
