import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "./brand";

// Mo, the Agent Mode mascot. All motion is driven by the current frame so renders are deterministic.
export const Mascot: React.FC<{
  size: number;
  talking?: boolean; // mouth flaps (pass true while a word is being spoken)
  wave?: boolean;
  enterDelay?: number; // frames before the pop-in
  mood?: "happy" | "shock" | "think"; // the eyes do the acting
}> = ({ size, talking = false, wave = false, enterDelay = 0, mood = "happy" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = BRAND.colors;

  // A true landing: one of the video's two allowed overshoots
  const pop = spring({ frame: frame - enterDelay, fps, config: { damping: 14.5, stiffness: 200 } });
  const bob = Math.sin(frame / 9) * 6;
  const tilt = Math.sin(frame / 23) * 3;
  // Blink for 4 frames every 2.7s, offset so frame 0 (used by stills) has open eyes
  const blink = (frame + 40) % 81 < 4 ? 0.12 : 1;
  const mouthOpen = talking ? 6 + Math.abs(Math.sin(frame / 2.2)) * 18 : 0;
  const eyeH = (mood === "shock" ? 62 : mood === "think" ? 30 : 54) * blink;
  const eyeW = mood === "shock" ? 42 : 34;
  const eyeY = (mood === "think" ? 150 : 162) + (54 - eyeH) / 2;
  const eyeDx = mood === "think" ? 10 : 0; // looking up-right while thinking
  const waveAngle = wave ? -30 + Math.sin(frame / 4) * 28 : 18;
  const glow = interpolate(Math.sin(frame / 7), [-1, 1], [0.35, 1]);

  return (
    <svg
      viewBox="0 0 400 480"
      width={size}
      height={size * 1.2}
      style={{ overflow: "visible", transform: `translateY(${bob}px) rotate(${tilt}deg) scale(${pop})` }}
    >
      <ellipse cx="200" cy="468" rx={110 - bob} ry="10" fill="#000" opacity=".35" />
      {/* antenna */}
      <line x1="200" y1="82" x2="200" y2="40" stroke={c.clay} strokeWidth="12" strokeLinecap="round" />
      <circle cx="200" cy="32" r="26" fill={c.clay} opacity={glow * 0.35} />
      <circle cx="200" cy="32" r="16" fill={c.ivory} />
      {/* arms */}
      <rect x="62" y="336" width="70" height="30" rx="15" fill={c.clayDark} transform="rotate(-18 128 350)" />
      <g transform={`rotate(${waveAngle} 272 350)`}>
        <rect x="268" y="336" width="78" height="30" rx="15" fill={c.clayDark} />
        <circle cx="346" cy="351" r="20" fill={c.clay} />
      </g>
      {/* body */}
      <rect x="120" y="312" width="160" height="140" rx="52" fill={c.clayDark} />
      <path d="M170 360 L196 382 L170 404" fill="none" stroke={c.ivory} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="206" y="394" width="30" height="10" rx="5" fill={c.ivory} />
      {/* head */}
      <rect x="60" y="80" width="280" height="240" rx="78" fill={c.clay} />
      <rect x="96" y="122" width="208" height="154" rx="48" fill={c.ink} />
      <rect x={159 - eyeW / 2 + eyeDx} y={eyeY} width={eyeW} height={eyeH} rx={eyeW / 2} fill={c.ivory} />
      <rect x={241 - eyeW / 2 + eyeDx} y={eyeY} width={eyeW} height={eyeH} rx={eyeW / 2} fill={c.ivory} />
      {talking ? (
        <rect x="178" y="236" width="44" height={mouthOpen} rx="10" fill={c.clay} />
      ) : mood === "shock" ? (
        <ellipse cx="200" cy="248" rx="16" ry="14" fill={c.clay} />
      ) : mood === "think" ? (
        <path d="M184 248 L216 244" fill="none" stroke={c.clay} strokeWidth="10" strokeLinecap="round" />
      ) : (
        <path d="M172 240 Q200 260 228 240" fill="none" stroke={c.clay} strokeWidth="10" strokeLinecap="round" />
      )}
      {/* cheeks */}
      <circle cx="120" cy="250" r="12" fill={c.clay} opacity=".55" />
      <circle cx="280" cy="250" r="12" fill={c.clay} opacity=".55" />
    </svg>
  );
};
