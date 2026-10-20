import { AbsoluteFill } from "remotion";
import { BRAND } from "./brand";
import { Mascot } from "./Mascot";

const C = BRAND.colors;

// YouTube banner: 2560x1440 canvas. Only the centre 1546x423 shows on every device, so all text + Mo stay there.
export const Banner: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily: BRAND.fonts.body }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 50%, ${C.clay}40, transparent 45%),
                     radial-gradient(ellipse at 75% 50%, ${C.clay}22, transparent 40%)`,
      }}
    />
    <AbsoluteFill
      style={{ backgroundImage: `radial-gradient(${C.slate} 3px, transparent 3px)`, backgroundSize: "56px 56px", opacity: 0.6 }}
    />
    {/* safe area */}
    <AbsoluteFill
      style={{
        top: (1440 - 423) / 2,
        left: (2560 - 1546) / 2,
        width: 1546,
        height: 423,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 64,
      }}
    >
      <div style={{ marginTop: -40 }}>
        {/* negative delay: a Still only has frame 0, so skip the pop-in */}
        <Mascot size={300} enterDelay={-60} wave />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: BRAND.fonts.heading, fontSize: 150, fontWeight: 700, color: C.ivory, lineHeight: 1 }}>
          Agent <span style={{ color: C.clay }}>Mode</span>
        </div>
        <div style={{ fontSize: 54, fontWeight: 500, color: C.oat }}>One AI upgrade, every day.</div>
        <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
          {["AI news", "Tips & hacks", "New skills"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: C.ink,
                background: C.clay,
                padding: "8px 26px",
                borderRadius: 999,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
