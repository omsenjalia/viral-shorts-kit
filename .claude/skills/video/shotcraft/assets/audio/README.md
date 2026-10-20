# Shotcraft audio (referenced, not included)

The upstream library ships ~150 sound effects and 5 BGM tracks here (`sfx/<category>/`, `bgm/`), mostly from Mixkit.
They are **not redistributed** in this repo. Their sources and licenses are listed in `ATTRIBUTION.md`, and
the files themselves are at https://github.com/Vincentwei1021/video-shotcraft/tree/main/assets/audio .

To use them locally: copy that upstream `assets/audio/bgm` and `assets/audio/sfx` into this folder (both are gitignored),
and check each file's license in `ATTRIBUTION.md` before using it in a published video.
The four sounds the Agent Mode shots need are fetched automatically by `scripts/fetch-sfx.mjs`.
