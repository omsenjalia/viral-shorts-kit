# Agent Mode brand kit

Everything brand-specific lives here. Change it here and every video updates.

| File | What it is |
|---|---|
| `brand.ts` | Name, colors, fonts, fps. The single source of truth. |
| `logo.svg` | Vector channel icon (Mo's face). |
| `Mascot.tsx` | **Mo**, the animated mascot: bobs, blinks, talks in sync with voiceover, waves. |
| `exports/channel-icon.png` | 800×800 YouTube profile picture. |
| `exports/mascot.png` | Transparent Mo for thumbnails. |
| `Banner.tsx` → `exports/channel-banner.png` | 2560×1440 YouTube banner. Everything important sits inside the 1546×423 safe area. |

## Colors (Claude-inspired warm palette)

| Token | Hex | Use |
|---|---|---|
| clay | `#D97757` | Accent, highlighted caption word, Mo |
| clayDark | `#B85C3E` | Mo's body and arms |
| ivory | `#FAF9F5` | Main text |
| oat | `#E3DACC` | Secondary text |
| ink | `#141413` | Background |
| slate | `#3D3D3A` | Grid dots, panels |
| sky / olive | `#6A9BCC` / `#788C5D` | Rare highlights |

## Fonts
- **Source Serif 4** (headings): editorial look
- **Inter** (body + captions)

Both load from Google Fonts via `@remotion/google-fonts`, so you don't need to install anything.

## Why an original mascot
Mo is our own character. Claude's mascot and logos belong to Anthropic, and using them would suggest an official affiliation.

## Re-export PNGs after editing
```bash
npx remotion still ChannelIcon brand-template/exports/channel-icon.png
npx remotion still ChannelBanner brand-template/exports/channel-banner.png
npx remotion still MascotPNG brand-template/exports/mascot.png --image-format=png
```
