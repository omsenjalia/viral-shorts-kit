// Mo3D: Mo, the Agent Mode mascot, as a real WebGL character (@remotion/three).
// Same design as brand-template/Mascot.tsx (clay head, ink face screen, ivory pill eyes, antenna, clayDark
// body with ">_", arms), lit like a studio product shot: key spot + clay rim + room env reflections.
// Data: { text?, accent?, mood?: "happy"|"shock"|"think", pose?: "present"|"wave"|"point" }.
// Every value is a function of useCurrentFrame(); the camera is shotcraft's Rig (src/sc/helpers/camera).
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BRAND } from "../../brand-template/brand";
import { E, PACE, SPR, hitPulse, mix, prog, rand } from "../lib/anim";
import { FONT, tracking } from "../sc/Polish";
import { Rig } from "../sc/helpers/camera";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";

const C = BRAND.colors;
type Mood = "happy" | "shock" | "think";
type Pose = "present" | "wave" | "point";
type V3 = [number, number, number];
const deg = (d: number) => (d * Math.PI) / 180;

// Mo's size in world units: hover gap + body + head + antenna ball top
const HOVER = 0.32;
const MO_H = HOVER + 4.48;
const MO_CY = MO_H / 2;
const FOV = 30;

/** Rounded rectangle in the XY plane (SVG rx), for the face screen, eyes and mouth. */
const rrect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** A flat glowing pill (w×h, fully rounded); geometry is rebuilt only when the size changes. */
const Pill: React.FC<{
  w: number;
  h: number;
  color: string;
  position: V3;
  opacity?: number;
}> = ({ w, h, color, position, opacity = 1 }) => {
  const kw = Math.round(w * 200) / 200,
    kh = Math.max(0.01, Math.round(h * 200) / 200);
  const geo = useMemo(
    () => new THREE.ShapeGeometry(rrect(kw, kh, Math.min(kw, kh) / 2), 16),
    [kw, kh],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={position}>
      <meshBasicMaterial
        color={color}
        toneMapped={false}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
};

/** A round-capped stroke from a to b in the XY plane (antenna, ">_" mark, mouth line). */
const Stroke: React.FC<{
  a: [number, number];
  b: [number, number];
  r: number;
  z: number;
  material: THREE.Material;
}> = ({ a, b, r, z, material }) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return (
    <mesh
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]}
      rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
      material={material}
      castShadow
    >
      <capsuleGeometry args={[r, len, 6, 16]} />
    </mesh>
  );
};

/** Soft radial sprite (contact shadow / screen glow), drawn once into a canvas. */
const useRadial = (inner: string, outer: string) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g2 = c.getContext("2d")!;
    const g = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    g2.fillStyle = g;
    g2.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [inner, outer]);

/** Studio reflections: three's RoomEnvironment through PMREM, plus brand-safe tone mapping. */
const Studio: React.FC<{ env: number }> = ({ env }) => {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }, [gl, scene]);
  scene.environmentIntensity = env;
  return null;
};

const Mo: React.FC<{
  f: number;
  fps: number;
  mood: Mood;
  pose: Pose;
  side: number;
  talking: boolean;
  lookUp: number;
  gestAt: number;
}> = ({ f, fps, mood, pose, side, talking, lookUp, gestAt }) => {
  // materials: vinyl clay with a soft clearcoat; the face is black glass
  const mats = useMemo(
    () => ({
      clay: new THREE.MeshPhysicalMaterial({
        color: C.clay,
        roughness: 0.38,
        clearcoat: 0.5,
        clearcoatRoughness: 0.28,
        sheen: 0.4,
        sheenColor: new THREE.Color("#ffd9c4"),
        sheenRoughness: 0.5,
      }),
      dark: new THREE.MeshPhysicalMaterial({
        color: C.clayDark,
        roughness: 0.42,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#0d0d0c",
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
      ivory: new THREE.MeshStandardMaterial({
        color: C.ivory,
        emissive: C.ivory,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      }),
    }),
    [],
  );
  const geo = useMemo(
    () => ({
      head: new RoundedBoxGeometry(2.8, 2.4, 2.0, 8, 0.66),
      body: new RoundedBoxGeometry(1.6, 1.4, 1.2, 8, 0.5),
      screen: new THREE.ExtrudeGeometry(rrect(2.08, 1.54, 0.48), {
        depth: 0.08,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.035,
        bevelSegments: 5,
        curveSegments: 24,
      }),
      smile: new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-0.28, 0.06, 0),
          new THREE.Vector3(0, -0.14, 0),
          new THREE.Vector3(0.28, 0.06, 0),
        ),
        24,
        0.05,
        8,
      ),
    }),
    [],
  );
  const glow = useRadial("rgba(250,249,245,0.55)", "rgba(250,249,245,0)");

  // Landing: a spring drop to hover height, the shot's one overshoot (SPR.land), with squash/stretch.
  const v = spring({ frame: f, fps, config: SPR.land });
  const settled = prog(f, 8, 20, E.smooth);
  const bob = Math.sin(f / 9) * 0.05 * settled;
  const y = HOVER + (1 - v) * 2.4 + bob;
  const sy = 1 - Math.max(-0.1, Math.min(0.2, v - 1)) * 0.8;
  const sxz = 1 / Math.sqrt(sy);

  // eyes act the mood (Mascot.tsx values / 100)
  const blink = (f + 40) % 81 < 4 ? 0.12 : 1;
  const shockPop =
    mood === "shock" ? 1 + 0.18 * Math.exp(-Math.max(0, f - 6) / 8) : 1;
  const eyeW = (mood === "shock" ? 0.42 : 0.34) * shockPop;
  const eyeH =
    (mood === "shock" ? 0.62 : mood === "think" ? 0.3 : 0.54) *
    blink *
    shockPop;
  const lookX =
    (mood === "think" ? 0.1 : 0) +
    side *
      0.07 *
      prog(f, gestAt - 6, gestAt + 6, E.out) *
      (pose === "wave" ? 0 : 1);
  const lookY = (mood === "think" ? 0.12 : 0) + lookUp * 0.06;
  const mouthOpen = talking ? 0.06 + Math.abs(Math.sin(f / 2.2)) * 0.18 : 0;

  // head acting: idle tilt, talking nods, think tilt, shock recoil
  const tilt = deg(Math.sin(f / 23) * 3) + (mood === "think" ? deg(7) : 0);
  const nod =
    (talking ? Math.sin(f / 3.1) * 0.035 : 0) +
    0.09 * hitPulse(f - gestAt, 3, 6); // a beat nod on the key word
  const recoil =
    mood === "shock" ? -0.12 * Math.exp(-Math.max(0, f - 6) / 10) : 0;
  const ballGlow =
    0.55 +
    0.45 * (0.5 + 0.5 * Math.sin(f / 7)) +
    (mood === "think" ? 0.4 * (0.5 + 0.5 * Math.sin(f / 3)) : 0);

  // arms: raise angle (deg, + = up); the gesture arm is on the text's side of the frame and lands on the key word
  const arrive = prog(f, gestAt - 6, gestAt + 8, E.out);
  const waveEnv =
    pose === "wave"
      ? prog(f, 8, 16, E.out) * (1 - prog(f, 78, 92, E.smooth))
      : 0;
  const waveDeg = 34 + Math.sin((f - 8) / 4) * 26;
  const poseDeg =
    pose === "point" ? (side > 0 ? 34 : 12) : pose === "present" ? 4 : 10;
  const reach = pose === "point" ? 1 + 0.55 * arrive : 1; // pointing telescopes the arm so the hand clears the head
  const gestureRaise = mix(mix(-22, poseDeg, arrive), waveDeg, waveEnv);
  const gestureFwd =
    pose === "present"
      ? deg(38) * arrive
      : pose === "point"
        ? deg(22) * arrive
        : deg(10);
  const restRaise = -22 + Math.sin(f / 11) * 2;

  const arm = (s: number, raise: number, fwd: number, key: string, r = 1) => (
    <group
      key={key}
      position={[s * 0.74, 1.12, 0]}
      rotation={[0, -s * fwd, s * deg(raise)]}
    >
      <mesh
        position={[s * 0.38 * r, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, r, 1]}
        material={mats.dark}
        castShadow
      >
        <capsuleGeometry args={[0.15, 0.5, 6, 16]} />
      </mesh>
      <mesh
        position={[s * (0.63 * r + 0.19), 0, 0]}
        material={mats.clay}
        castShadow
      >
        <sphereGeometry args={[0.21, 32, 16]} />
      </mesh>
    </group>
  );
  const z = 1.0 + 0.04; // face screen front (screen sits proud of the head's front face)
  const face = z + 0.085;

  return (
    <group position={[0, y, 0]} scale={[sxz, sy, sxz]}>
      {/* body */}
      <mesh
        geometry={geo.body}
        material={mats.dark}
        position={[0, 0.7, 0]}
        castShadow
        receiveShadow
      />
      <group position={[0, 0.76, 0.6]}>
        <Stroke
          a={[-0.3, 0.22]}
          b={[-0.04, 0]}
          r={0.05}
          z={0}
          material={mats.ivory}
        />
        <Stroke
          a={[-0.04, 0]}
          b={[-0.3, -0.22]}
          r={0.05}
          z={0}
          material={mats.ivory}
        />
        <Stroke
          a={[0.08, -0.18]}
          b={[0.32, -0.18]}
          r={0.05}
          z={0}
          material={mats.ivory}
        />
      </group>
      {arm(side, gestureRaise, gestureFwd, "g", reach)}
      {arm(-side, restRaise, deg(8), "r")}
      {/* head */}
      <group
        position={[0, 2.62, 0]}
        rotation={[nod + recoil - lookUp * 0.08, side * lookX * 0.6, tilt]}
      >
        <mesh
          geometry={geo.head}
          material={mats.clay}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geo.screen}
          material={mats.glass}
          position={[0, 0, z - 0.08 - 0.035]}
        />
        <Pill
          w={eyeW}
          h={eyeH}
          color={C.ivory}
          position={[-0.41 + lookX, 0.09 + lookY, face]}
        />
        <Pill
          w={eyeW}
          h={eyeH}
          color={C.ivory}
          position={[0.41 + lookX, 0.09 + lookY, face]}
        />
        {[-0.41, 0.41].map((ex) => (
          <mesh key={ex} position={[ex + lookX, 0.09 + lookY, face - 0.004]}>
            <planeGeometry args={[1.1, 1.3]} />
            <meshBasicMaterial
              map={glow}
              transparent
              opacity={0.22}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
        {/* mouth */}
        {talking ? (
          <Pill
            w={0.44}
            h={mouthOpen}
            color={C.clay}
            position={[0, -0.44 + lookY * 0.5, face]}
          />
        ) : mood === "shock" ? (
          <Pill w={0.3} h={0.27} color={C.clay} position={[0, -0.5, face]} />
        ) : mood === "think" ? (
          <mesh position={[0.02, -0.48, face]} rotation={[0, 0, deg(-8)]}>
            <capsuleGeometry args={[0.05, 0.3, 4, 12]} />
            <meshBasicMaterial color={C.clay} toneMapped={false} />
          </mesh>
        ) : (
          <mesh geometry={geo.smile} position={[0, -0.4, face]}>
            <meshBasicMaterial color={C.clay} toneMapped={false} />
          </mesh>
        )}
        {/* cheeks */}
        <Pill
          w={0.24}
          h={0.24}
          color={C.clay}
          opacity={0.5}
          position={[-0.8, -0.5, face]}
        />
        <Pill
          w={0.24}
          h={0.24}
          color={C.clay}
          opacity={0.5}
          position={[0.8, -0.5, face]}
        />
        {/* antenna */}
        <Stroke
          a={[0, 1.1]}
          b={[0, 1.55]}
          r={0.065}
          z={0}
          material={mats.clay}
        />
        <mesh position={[0, 1.7, 0]} castShadow>
          <sphereGeometry args={[0.17, 32, 16]} />
          <meshStandardMaterial
            color={C.ivory}
            emissive={C.ivory}
            emissiveIntensity={ballGlow}
            roughness={0.25}
          />
        </mesh>
        <sprite
          position={[0, 1.7, 0.05]}
          scale={[1.0 * ballGlow, 1.0 * ballGlow, 1]}
        >
          <spriteMaterial
            map={glow}
            transparent
            opacity={0.5}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </group>
  );
};

/** Concentric brushed-metal grain for the stage top (deterministic: seeded by ring index). */
const useBrushed = (light: boolean) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const g = c.getContext("2d")!;
    g.fillStyle = light ? "#f1ebe1" : "#3a3631";
    g.fillRect(0, 0, 1024, 1024);
    for (let r = 4; r < 512; r += 1.5) {
      const n = rand(r * 7.31);
      g.strokeStyle =
        n > 0.5
          ? `rgba(255,255,255,${(n - 0.5) * (light ? 0.22 : 0.16)})`
          : `rgba(0,0,0,${(0.5 - n) * (light ? 0.1 : 0.28)})`;
      g.lineWidth = 1 + rand(r * 3.7) * 1.5;
      g.beginPath();
      g.arc(512, 512, r, 0, Math.PI * 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  }, [light]);

/** Soft clay ring halo (transparent centre), laid on the stage top around its edge. */
const useRingGlow = () =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, "rgba(217,119,87,0)");
    gr.addColorStop(0.72, "rgba(217,119,87,0)");
    gr.addColorStop(0.86, "rgba(217,119,87,0.55)");
    gr.addColorStop(0.9, "rgba(217,119,87,0.25)");
    gr.addColorStop(1, "rgba(217,119,87,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

const STAGE_R = 2.6;
/**
 * Mo's hover stage: a shallow disc with a rounded bevel (lathe profile), a brushed top, a clay edge inlay with a
 * soft glow, and a faint hover beam up to Mo. It sits `top` below his hover floor so its rim clears the subtitles.
 */
const Stage: React.FC<{
  f: number;
  fps: number;
  light: boolean;
  top: number;
}> = ({ f, fps, light, top }) => {
  const brushed = useBrushed(light);
  const ring = useRingGlow();
  const beam = useMemo(() => {
    // vertical fade: strongest at the stage (v = 0 = bottom row), gone by Mo
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, `rgba(217,119,87,${light ? 0.2 : 0.3})`);
    gr.addColorStop(1, "rgba(217,119,87,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [light]);
  const blob = useRadial(
    light ? "rgba(70,50,35,0.5)" : "rgba(0,0,0,0.8)",
    light ? "rgba(70,50,35,0)" : "rgba(0,0,0,0)",
  );
  const body = useMemo(() => {
    // profile (r, y): flat top → quarter-round bevel → straight side → chamfered underside
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
    const bev = 0.16,
      R = STAGE_R;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      pts.push(
        new THREE.Vector2(
          R - bev + Math.sin(a) * bev,
          -bev + Math.cos(a) * bev,
        ),
      );
    }
    pts.push(
      new THREE.Vector2(R, -0.42),
      new THREE.Vector2(R - 0.12, -0.54),
      new THREE.Vector2(0, -0.54),
    );
    return new THREE.LatheGeometry(pts, 160);
  }, []);
  useEffect(() => () => body.dispose(), [body]);
  const v = spring({ frame: f, fps, config: SPR.land });
  const k = 1 / (1 + (1 - v) * 0.8); // shadow tightens as Mo lands
  const gap = -top;
  const pulse = 0.85 + 0.15 * Math.sin(f / 9);
  return (
    <group>
      <group position={[0, top, 0]}>
        <mesh geometry={body} receiveShadow>
          <meshPhysicalMaterial
            color={light ? "#e7dfd2" : "#2b2825"}
            metalness={light ? 0 : 0.55}
            roughness={light ? 0.42 : 0.32}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
          />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, 0]}
          receiveShadow
        >
          <circleGeometry args={[STAGE_R - 0.16, 128]} />
          <meshPhysicalMaterial
            map={brushed}
            metalness={light ? 0.05 : 0.7}
            roughness={light ? 0.38 : 0.3}
            clearcoat={0.5}
            clearcoatRoughness={0.15}
          />
        </mesh>
        {/* clay inlay just inside the bevel, and its glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <torusGeometry args={[STAGE_R - 0.24, 0.022, 10, 160]} />
          <meshBasicMaterial color={C.clay} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry
            args={[(STAGE_R - 0.24) * 2.3, (STAGE_R - 0.24) * 2.3]}
          />
          <meshBasicMaterial
            map={ring}
            transparent
            opacity={(light ? 0.7 : 1) * pulse}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Mo's soft shadow on the stage */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0.08]}
          scale={[k, k, 1]}
        >
          <planeGeometry args={[4.4, 3.2]} />
          <meshBasicMaterial
            map={blob}
            transparent
            opacity={0.55 * k}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* hover beam: the gap between Mo and the stage reads as lift, not a missing floor */}
      <mesh position={[0, top + gap / 2, 0]}>
        <cylinderGeometry args={[1.0, 1.7, gap, 64, 1, true]} />
        <meshBasicMaterial
          map={beam}
          transparent
          opacity={0.5 * pulse}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

/** Camera framing: distance + look point that put Mo (height MO_H) at `hPx` tall, centred at (cx, cy) px. */
const frameMo = (W: number, H: number, cx: number, cy: number, hPx: number) => {
  const upp = MO_H / hPx; // world units per pixel at Mo's depth
  const d = (H * upp) / (2 * Math.tan(deg(FOV / 2)));
  const look: V3 = [-(cx - W / 2) * upp, MO_CY + (cy - H / 2) * upp, 0];
  return { d, look };
};
const orbit = (look: V3, d: number, az: number, el: number): V3 => [
  look[0] + d * Math.sin(deg(az)) * Math.cos(deg(el)),
  look[1] + d * Math.sin(deg(el)),
  look[2] + d * Math.cos(deg(az)) * Math.cos(deg(el)),
];

const Mo3D: React.FC<SceneCtx<"mo3d">> = ({ scene, dur, S, vertical, cue }) => {
  const light = scene.ground === "paper";
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const text: string = typeof scene.text === "string" ? scene.text : "";
  const accent: string =
    typeof scene.accent === "string" ? scene.accent.toLowerCase() : "";
  const mood: Mood = ["happy", "shock", "think"].includes(scene.mood)
    ? scene.mood
    : "happy";
  const pose: Pose = ["present", "wave", "point"].includes(scene.pose)
    ? scene.pose
    : text
      ? "present"
      : "wave";
  const ms = (f / fps) * 1000;
  const talking = (scene.captions ?? []).some(
    (c) => ms >= c.startMs && ms < c.endMs,
  );

  // layout: vertical = text above Mo; wide = text left, Mo right. Content mass stays in y 230–1150 (vertical).
  const side = text ? (vertical ? 1 : -1) : 1;
  const fr = vertical
    ? text
      ? frameMo(W, H, W / 2, 825 * S, 560 * S)
      : frameMo(W, H, W / 2, 640 * S, 820 * S)
    : text
      ? frameMo(W, H, 1390 * S, 450 * S, 690 * S)
      : frameMo(W, H, W / 2, 450 * S, 690 * S);
  // stage top (world y, below Mo's hover floor): its rim must sit under the subtitle band (vertical y > 1430)
  const stageTop = vertical ? (text ? -4.3 : -3.8) : -2.2;
  // the gesture lands on the accent word (or soon after the landing)
  const gestAt = cue(accent.split(/\s+/)[0] || undefined, 18);
  // motivated move: a three-quarter that orbits round Mo and pushes in, through the whole scene
  const az0 = 26;
  const keyframes = [
    {
      frame: 0,
      pos: orbit(fr.look, fr.d * 1.14, az0, 12),
      look: fr.look,
      fov: FOV,
    },
    {
      frame: Math.max(dur, 2),
      pos: orbit(fr.look, fr.d * 0.93, -az0 * 0.55, 4),
      look: fr.look,
      fov: FOV,
    },
  ];

  const words = text.split(/\s+/).filter(Boolean);
  const accentSet = new Set(
    accent
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean),
  );
  const size = (vertical ? 100 : 104) * S;
  const camT = f / Math.max(1, dur);
  return (
    <AbsoluteFill style={{ background: light ? C.paper : C.ink }}>
      {/* studio backdrop: ink (or paper) cyc with a warm clay bloom behind Mo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${vertical ? "70% 38%" : "42% 62%"} at ${vertical ? "50% 52%" : text ? "70% 45%" : "50% 45%"}, ${C.clay}${light ? "1a" : "40"}, ${C.clay}${light ? "08" : "10"} 55%, transparent 75%)`,
        }}
      />
      <ThreeCanvas
        width={W}
        height={H}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Studio env={light ? 0.55 : 0.42} />
        <Rig keyframes={keyframes} easing={E.smooth} />
        <hemisphereLight
          args={["#fff2e6", light ? "#cbbfae" : "#141413", light ? 0.8 : 0.55]}
        />
        {/* key: soft spot from upper camera-left, casts the floor shadow */}
        <spotLight
          position={[-5.5, 10, 8]}
          angle={0.42}
          penumbra={0.9}
          intensity={3.1}
          decay={0}
          color="#fff5ec"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={6}
        >
          <object3D attach="target" position={[0, 2, 0]} />
        </spotLight>
        {/* rims: clay from behind-right, cool ivory kicker from behind-left */}
        <directionalLight
          position={[6, 5, -6]}
          intensity={light ? 2.2 : 3.4}
          color={C.clay}
        />
        <directionalLight
          position={[-6, 4, -5]}
          intensity={1.1}
          color="#f4ece2"
        />
        <Stage f={f} fps={fps} light={light} top={stageTop} />
        <Mo
          f={f}
          fps={fps}
          mood={mood}
          pose={pose}
          side={side}
          talking={talking}
          lookUp={vertical && text ? 1 : 0}
          gestAt={gestAt}
        />
      </ThreeCanvas>
      {text ? (
        <div
          style={{
            position: "absolute",
            ...(vertical
              ? { left: 80 * S, right: 80 * S, top: 250 * S, textAlign: "left" }
              : {
                  left: 160 * S,
                  width: 860 * S,
                  top: 0,
                  bottom: 230 * S,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }),
            transform: `translateX(${(camT - 0.5) * -18 * S}px)`, // a touch of parallax with the orbit
          }}
        >
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: size,
              lineHeight: 0.98,
              letterSpacing: tracking(size),
              color: light ? C.ink : C.ivory,
              textShadow: light
                ? undefined
                : `0 ${6 * S}px ${30 * S}px rgba(0,0,0,0.45)`,
            }}
          >
            {words.map((w, i) => {
              const p = prog(
                f,
                12 + i * PACE.stagger,
                12 + i * PACE.stagger + PACE.wordDur,
                E.outSoft,
              );
              const hot = accentSet.has(
                w.toLowerCase().replace(/[^a-z0-9]/g, ""),
              );
              const kick = hot ? 0.08 * hitPulse(f - gestAt, 3, 7) : 0; // the accent pops with Mo's gesture
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.24em",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 0.5}em) scale(${1 + kick})`,
                    color: hot ? C.clay : light ? C.ink : C.ivory,
                    fontStyle: hot ? "italic" : "normal",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const shot: ShotDef = {
  type: "mo3d",
  component: Mo3D,
  ground: "ink",
  fullBleed: true,
};
