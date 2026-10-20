// Type3D: 1–4 extruded, bevelled hero words in real WebGL light (@remotion/three). Each word stands up into
// place on its spoken cue; the camera holds a slow push on the first word, then pulls back one step per word,
// every frame fitted (by projection) inside the safe margins. Accent word in clay (italic, per brand).
// Grounds: ink (ivory type) or `ground: "paper"` (ink type on a warm paper wall). A soft contact shadow sits on
// the wall behind each word. Optional `film`: a filmstrip runs through the band under the subtitles from
// `film.at` and collapses into the accent word ("frames → MP4").
// Data: { words: [{ text, at? }], accent?, film?: { at?: string } }. Font: Inter Tight 800 (public/fonts, OFL).
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import {
  FontLoader,
  type Font,
} from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BRAND } from "../../brand-template/brand";
import { E, SPR, hitPulse, mix, prog, spr } from "../lib/anim";
import { Rig, type CamKeyframe } from "../sc/helpers/camera";
import type { SceneCtx } from "../types";
import type { ShotDef } from "./registry";

const C = BRAND.colors;
type V3 = [number, number, number];
const FOV = 28;
const LINE = 1.02; // line pitch, in font-size units (1 unit = 1 em)
const GAP = 0.3; // word gap
const WALL_Z = -0.75;
const SH_PX = 200; // contact-shadow canvas: px per em

const fonts: Record<string, Promise<Font>> = {};
const loadFont = (file: string) =>
  (fonts[file] ??= fetch(staticFile(`fonts/${file}`))
    .then((r) => r.json())
    .then((j) => new FontLoader().parse(j)));

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

type Laid = {
  text: string;
  hot: boolean;
  geo: THREE.BufferGeometry;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  w: number;
};

/** Lines: vertical stacks one word per line; wide sets ≤2 words on one line, 3–4 on two. */
const lineBreaks = (n: number, vertical: boolean) =>
  vertical
    ? Array.from({ length: n }, (_, i) => [i])
    : n <= 2
      ? [[...Array(n).keys()]]
      : n === 3
        ? [[0, 1], [2]]
        : [
            [0, 1],
            [2, 3],
          ];

type Reg = { x: number; y: number; w: number; h: number };
/**
 * Camera keyframe that fits the 3D box [x0,y0,x1,y1] × z±0.25 inside `reg` (px), seen along `dir`.
 * Exact: projects the 8 corners through a real camera, binary-searches the distance, then re-centres.
 */
const fitCam = (
  b: number[],
  W: number,
  H: number,
  reg: Reg,
  dir: V3,
  k = 1,
): Pick<CamKeyframe, "pos" | "look"> => {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 1000);
  const n = new THREE.Vector3(...dir).normalize();
  const look = new THREE.Vector3((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) =>
      new THREE.Vector3(
        i & 1 ? b[2] : b[0],
        i & 2 ? b[3] : b[1],
        i & 4 ? 0.25 : -0.25,
      ),
  );
  const extent = (d: number) => {
    cam.position.copy(look).addScaledVector(n, d);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    const ps = corners.map((c) => c.clone().project(cam));
    const xs = ps.map((p) => ((p.x + 1) / 2) * W),
      ys = ps.map((p) => ((1 - p.y) / 2) * H);
    return {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
  };
  let d = 10;
  for (let it = 0; it < 3; it++) {
    let lo = 0.5,
      hi = 400;
    for (let s = 0; s < 40; s++) {
      const mid = (lo + hi) / 2,
        e = extent(mid);
      if (e.x1 - e.x0 <= reg.w && e.y1 - e.y0 <= reg.h) hi = mid;
      else lo = mid;
    }
    d = hi;
    const e = extent(d);
    const upp = (2 * d * Math.tan(((FOV / 2) * Math.PI) / 180)) / H;
    // shift the look point in camera space so the projected box centre lands on the region centre
    const dx = (e.x0 + e.x1) / 2 - (reg.x + reg.w / 2),
      dy = (e.y0 + e.y1) / 2 - (reg.y + reg.h / 2);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0),
      up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    look.addScaledVector(right, dx * upp).addScaledVector(up, -dy * upp);
  }
  d *= k;
  const pos = look.clone().addScaledVector(n, d);
  return { look: [look.x, look.y, look.z], pos: [pos.x, pos.y, pos.z] };
};

/** Soft contact shadow: the word's silhouette drawn twice (tight + wide blur) into a canvas, laid on the wall. */
const makeShadow = (
  text: string,
  italic: boolean,
  family: string,
  minX: number,
) => {
  const pad = 60;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = `${italic ? "italic " : ""}800 ${SH_PX}px ${family}`;
  g.font = font;
  c.width = Math.ceil(g.measureText(text).width + pad * 2);
  c.height = Math.ceil(SH_PX * 1.3 + pad * 2);
  const base = pad + SH_PX * 1.0;
  g.font = font;
  g.fillStyle = "#000";
  g.filter = "blur(30px)";
  g.globalAlpha = 0.5;
  g.fillText(text, pad, base);
  g.filter = "blur(9px)";
  g.globalAlpha = 0.55;
  g.fillText(text, pad, base);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(c.width / SH_PX, c.height / SH_PX),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  // local origin = the word's glyph origin (geometry was shifted by -minX)
  mesh.position.set(
    -minX + (c.width / 2 - pad) / SH_PX,
    (base - c.height / 2) / SH_PX,
    0,
  );
  return mesh;
};

const Word: React.FC<{
  w: Laid;
  at: number;
  first: boolean;
  f: number;
  mats: THREE.Material[][];
  shadowA: number;
  pulse: number;
}> = ({ w, at, first, f, mats, shadowA, pulse }) => {
  // stands up from lying back (hinged on its baseline) and slides forward; calm spring, no overshoot on type.
  // The first word is already in flight on frame 0 (the cut lands mid-move).
  const start = first ? Math.min(at - 9, -14) : at - 9;
  if (f < start) return null;
  const p = spr(f, start, SPR.calm);
  (w.shadow.material as THREE.MeshBasicMaterial).opacity =
    shadowA * prog(p, 0.35, 1, E.smooth);
  const s = 1 + pulse;
  return (
    <group>
      {/* shadow sits on the wall, offset down-right from the key light */}
      <group position={[w.x + 0.05, w.y - 0.09, WALL_Z + 0.01]}>
        <primitive object={w.shadow} />
      </group>
      <group
        position={[
          w.x + (w.w * (1 - s)) / 2,
          w.y - (1 - p) * 0.25,
          -(1 - p) * 0.9,
        ]}
        rotation={[(-78 * (1 - p) * Math.PI) / 180, 0, 0]}
        scale={s}
      >
        <mesh geometry={w.geo} material={mats[w.hot ? 1 : 0]} />
      </group>
    </group>
  );
};

/** One "rendered frame" thumbnail: a tiny web page whose clay block has moved a little further each frame. */
const makeThumb = (i: number) => {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 200;
  const g = c.getContext("2d")!;
  g.fillStyle = C.ivory;
  g.fillRect(0, 0, 320, 200);
  g.fillStyle = "#E3DACC";
  g.fillRect(0, 0, 320, 30);
  ["#D97757", "#B9B2A6", "#B9B2A6"].forEach((col, k) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(18 + k * 16, 15, 5, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = C.ink;
  g.fillRect(22, 52, 170, 18);
  g.fillStyle = "#B9B2A6";
  g.fillRect(22, 82, 230, 9);
  g.fillRect(22, 98, 190, 9);
  const t = (i % 8) / 7;
  g.fillStyle = C.clay;
  g.fillRect(22 + t * 200, 126, 76, 50);
  g.fillStyle = "#6E665B";
  g.font = "600 15px monospace";
  g.fillText(`f ${String(i * 3).padStart(3, "0")}`, 250, 190);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** Sprocket strip texture (dark band, ground-coloured holes), repeated along the strip. */
const makeSprockets = (band: string, hole: string) => {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = band;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = hole;
  for (const y of [14, 220]) {
    g.beginPath();
    g.roundRect(40, y, 48, 22, 6);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
};

const CARDS = 12;
/**
 * The filmstrip lives in camera space (a lower-third that ignores the camera move) but is lit by the scene.
 * It unfurls after the first word, idles, runs fast from `runAt`, then its frames fly into `into` on `intoAt`.
 * Positions are written in useFrame because the camera pose is only known after Rig's useFrame (same frame).
 */
const Filmstrip: React.FC<{
  f: number;
  W: number;
  H: number;
  cy: number;
  hPx: number;
  showAt: number;
  runAt: number;
  intoAt: number;
  into: THREE.Vector3;
  light: boolean;
}> = ({ f, W, H, cy, hPx, showAt, runAt, intoAt, into, light }) => {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const strip = useRef<THREE.Mesh>(null);
  const rule = useRef<THREE.Mesh>(null);
  const cards = useRef<(THREE.Mesh | null)[]>([]);
  const thumbs = useMemo(
    () => Array.from({ length: CARDS }, (_, i) => makeThumb(i)),
    [],
  );
  const sprockets = useMemo(
    () =>
      makeSprockets(
        light ? "#1c1b19" : "#34312c",
        light ? "#F3EEE4" : "#151413",
      ),
    [light],
  );
  useEffect(
    () => () => [...thumbs, sprockets].forEach((t) => t.dispose()),
    [thumbs, sprockets],
  );

  const D = 6; // camera-space depth of the strip
  const upp = (2 * D * Math.tan(((FOV / 2) * Math.PI) / 180)) / H;
  const h = hPx * upp; // strip height in world units
  const cardH = h * 0.66,
    cardW = cardH * 1.6,
    pitch = cardW + h * 0.14;
  const L = pitch * CARDS; // loop length, wider than the frame
  const y0 = -(cy - H / 2) * upp;
  const stripW = W * upp * 1.2;
  sprockets.repeat.x = stripW / (h * 0.5);
  const open =
    prog(f, showAt, showAt + 14, E.out) *
    (1 - prog(f, intoAt - 2, intoAt + 10, E.in));
  // film travel (world units): slow idle, then a fast run from the capture cue; integrated so it never jumps
  const run = (t: number) =>
    Math.max(0, t - showAt) * 0.004 +
    Math.max(0, t - runAt) * 0.03 -
    Math.max(0, t - runAt - 12) * 0.012;
  const travel = run(f) * W * upp;

  useFrame(() => {
    if (!root.current) return;
    camera.updateMatrixWorld();
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const target = camera.worldToLocal(into.clone());
    if (strip.current) {
      strip.current.scale.set(1, Math.max(0.001, open), 1);
      sprockets.offset.x = travel / (h * 0.5);
    }
    cards.current.forEach((m, i) => {
      if (!m) return;
      const x = ((((i * pitch - travel) % L) + L) % L) - L / 2;
      const curl = 0.06 + Math.sin(x * 0.9) * 0.04; // always in front of the strip
      // collapse: frames nearest the centre leave first, each flies into the accent word and shrinks away
      const order = Math.abs(x) / (L / 2);
      const t = prog(f, intoAt - 12 + order * 8, intoAt + 2 + order * 8, E.in);
      m.position.lerpVectors(new THREE.Vector3(x, y0, -D + curl), target, t);
      const sc = Math.max(
        0.001,
        mix(Math.min(1, prog(f, showAt, showAt + 14, E.out)), 0.08, t),
      );
      m.scale.set(sc, sc, 1);
      m.rotation.set(
        0,
        Math.sin(x * 0.9) * 0.12 * (1 - t),
        mix(0, i % 2 ? 0.5 : -0.5, t),
      );
      m.visible = t < 0.98 && f >= showAt;
    });
    if (rule.current) {
      const r = prog(f, intoAt + 6, intoAt + 30, E.out);
      rule.current.scale.set(Math.max(0.001, r), 1, 1);
      rule.current.visible = r > 0;
    }
  });

  return (
    <group ref={root}>
      <mesh ref={strip} position={[0, y0, -D - 0.12]}>
        <planeGeometry args={[stripW, h]} />
        <meshStandardMaterial
          map={sprockets}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      {thumbs.map((tex, i) => (
        <mesh
          key={i}
          ref={(m) => {
            cards.current[i] = m;
          }}
        >
          <planeGeometry args={[cardW, cardH]} />
          <meshStandardMaterial
            map={tex}
            emissive="#ffffff"
            emissiveMap={tex}
            emissiveIntensity={0.35}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* after the collapse: a thin clay rule = "export done" */}
      <mesh ref={rule} position={[0, y0, -D]}>
        <boxGeometry args={[W * upp * 0.62, h * 0.045, 0.01]} />
        <meshBasicMaterial color={C.clay} toneMapped={false} />
      </mesh>
    </group>
  );
};

const Type3D: React.FC<SceneCtx<"type3d">> = ({
  scene,
  dur,
  S,
  vertical,
  cue,
}) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const light = scene.ground === "paper";
  const raw: { text: string; at?: string }[] = (
    Array.isArray(scene.words) && scene.words.length
      ? scene.words
      : [{ text: "Agent" }, { text: "Mode" }]
  )
    .filter(
      (w: { text?: unknown }) => typeof w?.text === "string" && w.text.trim(),
    )
    .slice(0, 4);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const accent = norm(
    typeof scene.accent === "string"
      ? scene.accent
      : raw.length > 1
        ? raw[raw.length - 1].text
        : "",
  );
  const film: { at?: string } | null =
    scene.film && typeof scene.film === "object"
      ? scene.film
      : scene.film === true
        ? {}
        : null;

  const [font, setFont] = useState<Font[] | null>(null);
  const [handle] = useState(() => delayRender("Loading Inter Tight typeface"));
  useEffect(() => {
    // the CSS face is needed too: the contact shadows are drawn with it into a canvas
    const css = [
      `800 100px ${BRAND.fonts.display}`,
      `italic 800 100px ${BRAND.fonts.display}`,
    ].map((q) => document.fonts.load(q));
    Promise.all([
      loadFont("InterTight-ExtraBold.typeface.json"),
      loadFont("InterTight-ExtraBoldItalic.typeface.json"),
      ...css,
    ])
      .then(([a, b]) => {
        setFont([a as Font, b as Font]);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  const mats = useMemo(() => {
    const face = (color: string, rough: number) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: rough,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      });
    const side = (color: string) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      });
    return light
      ? [
          [face(C.ink, 0.42), side("#2c2a27")],
          [face(C.clay, 0.36), side(C.clayDark)],
        ]
      : [
          [face(C.ivory, 0.34), side("#d6ccbc")],
          [face(C.clay, 0.36), side(C.clayDark)],
        ];
  }, [light]);

  // geometry + layout (font units: size 1)
  const key = raw.map((w) => w.text).join("|") + accent + vertical;
  const laid = useMemo<Laid[]>(() => {
    if (!font) return [];
    const words = raw.map((w) => {
      const hot = norm(w.text) === accent;
      const tg = new TextGeometry(w.text, {
        font: font[hot ? 1 : 0],
        size: 1,
        depth: 0.3,
        curveSegments: 18,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.032,
        bevelSegments: 8,
      });
      // smooth the bevel into the caps/sides (hard corners stay hard); scaled ×100 because the helper hashes at 0.01
      tg.scale(100, 100, 100);
      const geo = toCreasedNormals(tg, Math.PI / 4);
      geo.scale(0.01, 0.01, 0.01);
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      geo.translate(-bb.min.x, 0, -0.15);
      return {
        text: w.text,
        hot,
        geo,
        shadow: makeShadow(w.text, hot, BRAND.fonts.display, bb.min.x),
        x: 0,
        y: 0,
        w: bb.max.x - bb.min.x,
      };
    });
    const lines = lineBreaks(words.length, vertical);
    lines.forEach((ln, li) => {
      const lw = ln.reduce((a, i) => a + words[i].w, 0) + GAP * (ln.length - 1);
      let x = -lw / 2;
      for (const i of ln) {
        words[i].x = x;
        words[i].y = ((lines.length - 1) / 2 - li) * LINE - 0.36; // centre the block on cap height
        x += words[i].w + GAP;
      }
    });
    return words;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [font, key]);
  useEffect(
    () => () =>
      laid.forEach((w) => {
        w.geo.dispose();
        w.shadow.geometry.dispose();
        (w.shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      }),
    [laid],
  );
  const ats = laid.map((_, i) => cue(raw[i].at ?? raw[i].text, 8 + i * 16));
  const hotIdx = laid.findIndex((w) => w.hot);
  const intoIdx = hotIdx >= 0 ? hotIdx : laid.length - 1;

  // safe regions (px): the type block, and (with `film`) the lower band for the strip
  const reg: Reg = vertical
    ? { x: 100 * S, y: 270 * S, w: 880 * S, h: 860 * S }
    : film
      ? { x: 180 * S, y: 140 * S, w: 1560 * S, h: 500 * S }
      : { x: 180 * S, y: 150 * S, w: 1560 * S, h: 640 * S };
  const box = (n: number) => {
    const ws = laid.slice(0, n);
    return [
      Math.min(...ws.map((w) => w.x)),
      Math.min(...ws.map((w) => w.y)) - 0.26,
      Math.max(...ws.map((w) => w.x + w.w)),
      Math.max(...ws.map((w) => w.y)) + 0.98,
    ];
  };
  const atsKey = ats.join(",");
  const keys = useMemo<CamKeyframe[]>(() => {
    if (!laid.length) return [];
    const k: CamKeyframe[] = [];
    const add = (frame: number, b: number[], dir: V3, kk = 1) =>
      k.push({
        frame: Math.max(frame, k.length ? k[k.length - 1].frame + 6 : 0),
        ...fitCam(b, W, H, reg, dir, kk),
        fov: FOV,
      });
    // hold on word 1: a slow push + orbit (never past the margins), then one pull-back per word as it lands
    add(0, box(1), [0.42, 0.2, 1], 1.16);
    add(laid.length > 1 ? ats[1] - 12 : dur - 1, box(1), [0.22, 0.12, 1]);
    for (let i = 1; i < laid.length; i++)
      add(ats[i] + 4, box(i + 1), i % 2 ? [0.18, 0.1, 1] : [0.26, 0.14, 1]);
    if (laid.length > 1 && dur > k[k.length - 1].frame + 12)
      add(dur, box(laid.length), [0.08, 0.06, 1]);
    return k;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid, W, H, S, vertical, !!film, dur, atsKey]);

  const into = laid[intoIdx];
  const intoAt = ats[intoIdx] ?? dur;
  const pulse = (i: number) =>
    film && i === intoIdx ? 0.05 * hitPulse(f - (intoAt + 4)) : 0;
  const wall = light ? "#F3EEE4" : "#1b1a18";

  return (
    <AbsoluteFill style={{ background: wall }}>
      {/* mounted only once the fonts are in: R3F renders on create, and a later state change would not redraw a still */}
      {font ? (
        <ThreeCanvas
          width={W}
          height={H}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.setClearColor(wall);
          }}
        >
          <Studio env={light ? 0.75 : 0.55} />
          {keys.length ? <Rig keyframes={keys} easing={E.smooth} /> : null}
          <hemisphereLight
            args={["#fff2e6", light ? "#cfc6b8" : "#141413", light ? 0.9 : 0.5]}
          />
          {/* key: soft spot from upper camera-left */}
          <spotLight
            position={[-6, 8, 12]}
            angle={0.6}
            penumbra={0.9}
            intensity={light ? 2.2 : 2.6}
            decay={0}
            color="#fff6ee"
          >
            <object3D attach="target" position={[0, 0, 0]} />
          </spotLight>
          {/* clay rim from behind-right: a warm line on every bevel and extrusion edge */}
          <directionalLight
            position={[7, 4, -3]}
            intensity={light ? 3.2 : 2.6}
            color={C.clay}
          />
          <directionalLight
            position={[-5, 6, -2]}
            intensity={0.8}
            color="#f4ece2"
          />
          {/* the wall: flat brand colour (exact); shadows are the contact decals */}
          <mesh position={[0, 0, WALL_Z]}>
            <planeGeometry args={[400, 400]} />
            <meshBasicMaterial color={wall} toneMapped={false} />
          </mesh>
          {laid.map((w, i) => (
            <Word
              key={i}
              w={w}
              at={ats[i]}
              first={i === 0}
              f={f}
              mats={mats}
              shadowA={light ? 0.38 : 0.75}
              pulse={pulse(i)}
            />
          ))}
          {film && into ? (
            <Filmstrip
              f={f}
              W={W}
              H={H}
              cy={(vertical ? 1530 : 720) * S}
              hPx={(vertical ? 150 : 104) * S}
              showAt={Math.min(ats[0] + 10, intoAt - 40)}
              runAt={cue(film.at, Math.round((ats[0] + intoAt) / 2))}
              intoAt={intoAt}
              into={new THREE.Vector3(into.x + into.w / 2, into.y + 0.36, 0)}
              light={light}
            />
          ) : null}
        </ThreeCanvas>
      ) : null}
      {/* lens vignette keeps the eye on the type */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% ${vertical ? 40 : 46}%, transparent 55%, ${light ? "rgba(110,90,70,0.16)" : `${C.ink}cc`} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const shot: ShotDef = {
  type: "type3d",
  component: Type3D,
  ground: "ink",
  fullBleed: true,
};
