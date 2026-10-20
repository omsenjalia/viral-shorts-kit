"""Turn episodes/<slug>.json into ONE stitched voiceover track + word captions per scene.

Usage: python scripts/voice.py <slug>
Writes public/episodes/<slug>/voice.wav and manifest.json.

Voice is Kokoro (local, kokoro-onnx) with word times from faster-whisper, mapped back onto
the narration's own words. Set "engine": "edge" in the episode JSON to use edge-tts instead.

Each scene is synthesised on its own (natural sentence prosody), then tightened the way
launch films are cut: leading/trailing silence trimmed, pauses inside a line shrunk to ~0.2 s,
a short breath between scenes, and every scene padded to a whole video frame so picture
and voice never drift. Captions are re-timed through the same cuts.
"""
import asyncio
import difflib
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
DEFAULT_VOICE = "am_fenrir"  # Kokoro; picked over am_michael/am_puck/am_adam for clarity and energy
DEFAULT_SPEED = 1.15
EDGE_VOICE = "en-US-AndrewMultilingualNeural"
EDGE_RATE = "+20%"
SR = 24000  # Kokoro and edge-tts native rate
FPS = 30  # must match brand-template/brand.ts
SPF = SR // FPS  # samples per video frame
SILENCE_DB = -42
LEAD, TRAIL, KEEP_PAUSE, MAX_PAUSE = 0.02, 0.06, 0.09, 0.22  # seconds
BREATH = 0.16  # between scenes


async def synth(text: str, voice: str, rate: str, mp3: Path) -> list[dict]:
    import edge_tts

    words = []
    with mp3.open("wb") as f:
        async for chunk in edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary").stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7  # 100ns ticks -> s
                words.append((chunk["text"], start, start + chunk["duration"] / 1e7))
    return words


class Kokoro:
    def __init__(self, voice: str, speed: float):
        from faster_whisper import WhisperModel
        from kokoro_onnx import Kokoro as K

        self.tts = K(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
        self.asr = WhisperModel("base.en", device="cpu", compute_type="int8", download_root=str(MODELS / "whisper"))
        self.voice, self.speed = voice, speed

    def synth(self, text: str, wav: Path):
        x, sr = self.tts.create(text, voice=self.voice, speed=self.speed, lang="en-us")
        assert sr == SR, sr
        x = x.astype(np.float32)
        write_wav(wav, x)
        # whisper takes 16 kHz arrays; ffmpeg resamples (its own file loader needs a newer PyAV)
        segs, _ = self.asr.transcribe(decode(wav, 16000), language="en", word_timestamps=True, initial_prompt=text)
        heard = [(w.word, w.start, w.end) for s in segs for w in s.words]
        return x, snap(align(text.split(), heard), x)


def align(script: list[str], heard: list[tuple]) -> list[tuple]:
    """Give each script word the times of the whisper words its letters match, so captions keep the script's spelling."""
    a = [(c, i) for i, w in enumerate(script) for c in norm(w)]
    b = [(c, j) for j, (w, _, _) in enumerate(heard) for c in norm(w)]
    span = [[None, None] for _ in script]
    sm = difflib.SequenceMatcher(None, [c for c, _ in a], [c for c, _ in b], autojunk=False)
    for ai, bi, n in sm.get_matching_blocks():
        for k in range(n):
            i, j = a[ai + k][1], b[bi + k][1]
            s, e = span[i]
            span[i] = [heard[j][1] if s is None else min(s, heard[j][1]), heard[j][2] if e is None else max(e, heard[j][2])]
    # words whisper missed or spelled differently ("twenty" vs "20") share the gap between their neighbours
    i = 0
    while i < len(span):
        if span[i][0] is not None:
            i += 1
            continue
        j = i
        while j < len(span) and span[j][0] is None:
            j += 1
        lo = span[i - 1][1] if i else (heard[0][1] if heard else 0.0)
        hi = span[j][0] if j < len(span) else (heard[-1][2] if heard else lo)
        hi = max(hi, lo)
        step = (hi - lo) / (j - i)
        for k in range(i, j):
            span[k] = [lo + (k - i) * step, lo + (k - i + 1) * step]
        i = j
    return [(w, s, e) for w, (s, e) in zip(script, span)]


def snap(words: list[tuple], x: np.ndarray) -> list[tuple]:
    """Whisper word edges drift ~0.2 s into pauses; move them onto the real silences in the take."""
    w = [[t, a, b] for t, a, b in words]
    silent = quiet(x)
    loud = np.where(~silent)[0]
    if not len(loud) or not w:
        return words
    w[0][1], w[-1][2] = loud[0] / 100, (loud[-1] + 1) / 100  # 10 ms windows
    i = loud[0]
    while i <= loud[-1]:
        j = i
        while silent[j]:
            j += 1
        a, b = i / 100, j / 100
        if b - a >= 0.1:  # a real pause, not a stop consonant
            k = min(range(len(w) - 1), key=lambda k: abs((w[k][2] + w[k + 1][1]) / 2 - (a + b) / 2), default=None)
            if k is not None and w[k][1] < a and b < w[k + 1][2] and abs((w[k][2] + w[k + 1][1]) / 2 - (a + b) / 2) < 0.35:
                w[k][2], w[k + 1][1] = a, b
        i = j + 1
    return [tuple(v) for v in w]


def quiet(x: np.ndarray) -> np.ndarray:
    """One flag per 10 ms window: below SILENCE_DB."""
    win = SR // 100
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms) < SILENCE_DB


def decode(mp3: Path, sr: int = SR) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def tighten(x: np.ndarray):
    """Cut silences; return the new signal and a function mapping old seconds -> new seconds."""
    win = SR // 100  # 10 ms
    silent = quiet(x)
    n = len(silent)
    cuts = []  # (start_sample, end_sample) removed
    i = 0
    while i < n:
        if not silent[i]:
            i += 1
            continue
        j = i
        while j < n and silent[j]:
            j += 1
        a, b = i * win, (j * win if j < n else len(x))
        if a == 0:
            cuts.append((0, max(0, b - int(LEAD * SR))))
        elif b >= len(x) - win:
            cuts.append((min(len(x), a + int(TRAIL * SR)), len(x)))
        elif (b - a) / SR > MAX_PAUSE:
            k = int(KEEP_PAUSE * SR)
            cuts.append((a + k, b - k))
        i = j
    cuts = [(a, b) for a, b in cuts if b > a]
    keep, last = [], 0
    for a, b in cuts:
        keep.append(x[last:a])
        last = b
    keep.append(x[last:])
    y = np.concatenate(keep) if keep else x

    def remap(t: float) -> float:
        s = int(t * SR)
        removed = 0
        for a, b in cuts:
            if s >= b:
                removed += b - a
            elif s > a:
                removed += s - a
        return (s - removed) / SR

    return y, remap


def write_wav(path: Path, x: np.ndarray):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


async def main(slug: str) -> None:
    episode = json.loads((ROOT / "episodes" / f"{slug}.json").read_text(encoding="utf-8"))
    out_dir = ROOT / "public" / "episodes" / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("scene-*.mp3"):
        old.unlink()
    edge = episode.get("engine") == "edge"
    if edge:
        voice, rate = episode.get("voice", EDGE_VOICE), episode.get("rate", EDGE_RATE)
        tmp = out_dir / "_take.mp3"
    else:
        kokoro = Kokoro(episode.get("voice", DEFAULT_VOICE), float(episode.get("speed", DEFAULT_SPEED)))
        tmp = out_dir / "_take.wav"

    scenes, track, total_words = [], [], 0
    for i, scene in enumerate(episode["scenes"]):
        if not scene.get("narration", "").strip():
            sys.exit(f"scene {i} has no narration")
        if edge:
            words = await synth(scene["narration"], voice, rate, tmp)
            x = decode(tmp)
        else:
            x, words = kokoro.synth(scene["narration"], tmp)
        y, remap = tighten(x)
        last = i == len(episode["scenes"]) - 1
        # breath between scenes, then pad to a whole video frame
        y = np.concatenate([y, np.zeros(int((0.6 if last else BREATH) * SR), np.float32)])
        frames = -(-len(y) // SPF)
        y = np.concatenate([y, np.zeros(frames * SPF - len(y), np.float32)])
        track.append(y)
        captions = []
        for k, (text, a, b) in enumerate(words):
            sa, sb = remap(a), remap(b)
            captions.append({
                # leading space: Remotion captions are whitespace-sensitive
                "text": (" " if k else "") + text,
                "startMs": round(sa * 1000),
                "endMs": round(max(sb, sa + 0.05) * 1000),
                "timestampMs": round(sa * 1000),
                "confidence": None,
            })
        total_words += len(words)
        scenes.append({**scene, "frames": frames, "durationMs": round(frames * 1000 / FPS), "captions": captions})
        print(f"scene {i}: {frames / FPS:.2f}s, {len(words)} words")
    tmp.unlink(missing_ok=True)

    write_wav(out_dir / "voice.wav", np.concatenate(track))
    seconds = sum(s["frames"] for s in scenes) / FPS
    print(f"voice: {seconds:.1f}s, {total_words / seconds:.2f} words/s")
    manifest = {"title": episode["title"], "voice": f"episodes/{slug}/voice.wav", "scenes": scenes}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {out_dir / 'manifest.json'}")
    for w in lint(scenes):
        print(f"WARN {w}")
    if total_words / seconds < 2.6:
        print(f"WARN pace {total_words / seconds:.2f} words/s; Shorts feel slow under ~2.6. Cut pauses/words or raise \"speed\" (\"rate\" for edge)")


def norm(w: str) -> str:
    return "".join(ch for ch in w.lower() if ch.isalnum())


def cue_ms(scene: dict, word: str):
    w = norm(word)
    for exact in (True, False):
        for c in scene["captions"]:
            t = norm(c["text"])
            if (t == w) if exact else t.startswith(w):
                return c["startMs"]
    return None


def lint(scenes: list[dict]) -> list[str]:
    """Timing problems a contact sheet would show: dead openings, unspoken cue words, long hooks."""
    out = []
    total = sum(s["frames"] for s in scenes) / FPS
    for i, s in enumerate(scenes):
        beats = [x.get("at") for x in s.get("fragments", []) + s.get("items", []) + s.get("lines", [])]
        beats += [s.get("at"), (s.get("after") or {}).get("at")]
        for word in filter(None, beats):
            if cue_ms(s, word) is None:
                out.append(f"scene {i} ({s['type']}): cue word '{word}' is not spoken; beat falls back to even spacing")
        first = (s.get("fragments") or s.get("items") or [{}])[0].get("at")
        if first and (t := cue_ms(s, first)) is not None and t > 900:
            out.append(f"scene {i} ({s['type']}): first beat lands at {t/1000:.1f}s; put '{first}' in the first few words or the opening is an empty frame")
    if scenes and scenes[0]["type"] == "hook" and scenes[0]["durationMs"] > 3500:
        out.append(f"hook narration is {scenes[0]['durationMs']/1000:.1f}s; keep it under 3.5s")
    if total > 45:
        out.append(f"total {total:.1f}s; Shorts land best at 25-45s (fine for long-form)")
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/voice.py <slug>")
    asyncio.run(main(sys.argv[1]))
