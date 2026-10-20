"""Original, royalty-free music bed for an episode (no Content ID risk).

Usage: python scripts/music.py <slug>
Reads public/episodes/<slug>/manifest.json for the length, writes music.wav beside it,
and records it in the manifest. Seeded by the slug, so each episode gets its own key,
tempo and progression, and a re-run gives the same track.

To use a real track instead, put an mp3/wav in brand-template/music/ and set
"music": "<file name>" in the episode JSON (YouTube Audio Library tracks are safe).
"""
import hashlib
import json
import shutil
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
PAD_MS = 200  # must match src/Episode.tsx

PROGRESSIONS = [  # (semitone offset, chord intervals): warm minor loops
    [(0, (0, 3, 7, 10)), (8, (0, 4, 7, 11)), (3, (0, 4, 7, 11)), (10, (0, 4, 7))],  # i VI III VII
    [(0, (0, 3, 7, 10)), (5, (0, 3, 7, 10)), (8, (0, 4, 7, 11)), (7, (0, 3, 7))],  # i iv VI v
    [(0, (0, 3, 7, 10)), (10, (0, 4, 7)), (8, (0, 4, 7, 11)), (10, (0, 4, 7, 9))],  # i VII VI VII
]


def hz(midi: float) -> np.ndarray:
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(freq, dur, partials=((1, 1.0),), attack=0.005, decay=None, release=0.08):
    """Additive tone with an AD(S)R-ish envelope. Click-free: cosine tails."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = sum(a * np.sin(2 * np.pi * freq * k * t) for k, a in partials)
    env = np.ones(n)
    a = max(1, int(attack * SR))
    env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if decay:
        env *= np.exp(-t / decay)
    r = min(n, int(release * SR))
    env[n - r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return sig * env


def add(buf, sig, at, gain):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def noise(dur, decay, rng, bright=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    if bright:
        x = np.diff(x, prepend=0)  # crude highpass
    else:
        x = np.convolve(x, np.ones(8) / 8, mode="same")  # crude lowpass
    return x * np.exp(-np.arange(n) / SR / decay)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 85 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(f) / SR  # integrated phase: no chirp clicks
    return np.sin(phase) * np.exp(-t / 0.12)


def render(seconds: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    bpm = [92, 96, 100, 104][seed % 4]
    root = [57, 60, 62, 53][(seed // 4) % 4]  # A3, C4, D4, F3
    prog = PROGRESSIONS[(seed // 16) % len(PROGRESSIONS)]
    beat = 60 / bpm
    bar = 4 * beat
    total = seconds + 1.5
    buf = np.zeros(int(total * SR))
    pad_p = ((1, 1.0), (2, 0.18), (3, 0.06))
    key_p = ((1, 1.0), (2, 0.35), (4, 0.08))

    b = 0
    while b * bar < total:
        off, chord = prog[b % len(prog)]
        t0 = b * bar
        base = root + off
        # pad: whole bar, soft attack, detuned pair for width
        for iv in chord:
            for det in (-0.06, 0.06):
                add(buf, tone(hz(base + iv + det), bar + 0.3, pad_p, attack=0.25, release=0.4), t0, 0.035)
        # bass: root on 1, fifth pickup on the "and" of 3
        add(buf, tone(hz(base - 24), beat * 1.8, ((1, 1), (2, 0.25)), attack=0.01, decay=0.5), t0, 0.22)
        add(buf, tone(hz(base - 24 + 7), beat * 0.9, ((1, 1), (2, 0.25)), attack=0.01, decay=0.3), t0 + 2.5 * beat, 0.14)
        # keys: gentle 8th-note arpeggio, a little swing and velocity variation
        notes = [base + 12 + iv for iv in chord]
        for k in range(8):
            if rng.random() < 0.18:
                continue
            n = notes[[0, 2, 1, 3, 2, 1, 3, 2][k] % len(notes)]
            swing = 0.03 * beat if k % 2 else 0
            add(buf, tone(hz(n), 0.6, key_p, attack=0.004, decay=0.28), t0 + k * beat / 2 + swing, 0.05 + rng.random() * 0.02)
        # drums
        for q in range(4):
            tq = t0 + q * beat
            if q in (0, 2):
                add(buf, kick(), tq, 0.55)
            if q in (1, 3):
                add(buf, noise(0.18, 0.05, rng, bright=False), tq, 0.10)  # soft snare body
                add(buf, noise(0.12, 0.03, rng), tq, 0.05)
            for h in (0, 1):  # hats on 8ths, offbeats louder
                add(buf, noise(0.05, 0.012, rng), tq + h * beat / 2 + (0.02 * beat if h else 0), 0.045 if h else 0.025)
        b += 1

    buf = buf[: int(seconds * SR)]
    # gentle compression-ish soft clip, then normalise to -1 dBFS
    buf = np.tanh(buf * 1.4)
    buf /= np.max(np.abs(buf)) / 0.89
    tail = int(1.2 * SR)  # ending subtracts: fade the last 1.2 s
    buf[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail)) ** 2
    buf[-480:] = 0
    return buf


def write_wav(path: Path, x: np.ndarray):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    stereo = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


def main(slug: str):
    out_dir = ROOT / "public" / "episodes" / slug
    manifest_path = out_dir / "manifest.json"
    m = json.loads(manifest_path.read_text(encoding="utf-8"))
    episode = json.loads((ROOT / "episodes" / f"{slug}.json").read_text(encoding="utf-8"))
    choice = episode.get("music", "auto")

    if choice in (None, "none", False):
        m.pop("music", None)
    elif choice == "auto":
        seconds = sum(s["frames"] for s in m["scenes"]) / 30
        seed = int(hashlib.md5(slug.encode()).hexdigest(), 16) % 10_000
        write_wav(out_dir / "music.wav", render(seconds, seed))
        m["music"] = f"episodes/{slug}/music.wav"
        print(f"music: original bed, {seconds:.1f}s, seed {seed}")
    else:
        src = ROOT / "brand-template" / "music" / choice
        if not src.exists():
            sys.exit(f"music file not found: {src}")
        shutil.copy(src, out_dir / src.name)
        m["music"] = f"episodes/{slug}/{src.name}"
        print(f"music: {src.name}")

    manifest_path.write_text(json.dumps(m, indent=2), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/music.py <slug>")
    main(sys.argv[1])
