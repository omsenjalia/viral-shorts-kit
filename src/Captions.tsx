import { useMemo } from "react";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand-template/brand";

const SWITCH_CAPTIONS_EVERY_MS = 700;

type Colors = { fg: string; active: string; stroke: string };

const CaptionPage: React.FC<{ page: TikTokPage; fontSize: number; c: Colors }> = ({ page, fontSize, c }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;
  const pop = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 6 });

  return (
    <div
      style={{
        fontFamily: BRAND.fonts.body,
        fontSize,
        fontWeight: 900,
        whiteSpace: "pre-wrap",
        lineHeight: 1.1,
        textAlign: "center",
        textTransform: "uppercase",
        WebkitTextStroke: `${fontSize / 7}px ${c.stroke}`,
        // solid drop shadow keeps them punchy on light and orange grounds too
        textShadow: `0 ${fontSize * 0.07}px 0 ${c.stroke}`,
        paintOrder: "stroke",
        transform: `scale(${0.85 + 0.15 * pop})`,
      }}
    >
      {page.tokens.map((token, i) => {
        const active = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
        return (
          <span key={`${token.fromMs}-${i}`} style={{ color: active ? c.active : c.fg }}>
            {token.text}
          </span>
        );
      })}
    </div>
  );
};

export const Captions: React.FC<{ captions: Caption[]; top: string; fontSize: number; colors: Colors }> = ({
  captions,
  top,
  fontSize,
  colors,
}) => {
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS }),
    [captions],
  );

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const next = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = next ? Math.round((next.startMs / 1000) * fps) : startFrame + Math.round(1.5 * fps);
        if (endFrame <= startFrame) return null;
        return (
          <Sequence key={index} from={startFrame} durationInFrames={endFrame - startFrame} layout="none">
            <AbsoluteFill style={{ top, height: "auto", alignItems: "center", padding: "0 80px" }}>
              <CaptionPage page={page} fontSize={fontSize} c={colors} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
