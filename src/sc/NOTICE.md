# src/sc: adapted from video-shotcraft

These files are adapted from [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)
(Apache License 2.0, see `.claude/skills/video/shotcraft/LICENSE`, upstream commit in `shotcraft/UPSTREAM.txt`).

Changes for Agent Mode:
- `Polish.tsx`: `FONT` uses our Google fonts (Inter Tight / JetBrains Mono) instead of macOS system fonts.
- `Look.tsx`: added the `agentmode`, `agentclay` and `agentpaper` looks; `SERIF` is the brand serif.
- `src/shots/*` are data-driven ports of shotcraft demos, re-skinned to the brand and laid out for 9:16 and 16:9.
