// One command from episode JSON to finished files.
// Usage: node scripts/build.mjs <slug> [--format short|long|both] [--skip-voice]
// Output: out/<slug>/<slug>-short.mp4, -long.mp4, thumbnail.png, sheet-*.png (1 fps contact sheet)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error("usage: node scripts/build.mjs <slug> [--format short|long|both] [--skip-voice]");
  process.exit(1);
}
const fmtIdx = rest.indexOf("--format");
const format = fmtIdx >= 0 ? rest[fmtIdx + 1] : "short";
if (!["short", "long", "both"].includes(format)) {
  console.error(`unknown --format ${format}`);
  process.exit(1);
}
if (!existsSync(`episodes/${slug}.json`)) {
  console.error(`missing episodes/${slug}.json`);
  process.exit(1);
}

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", shell: true });
};

const out = `out/${slug}`;
mkdirSync(out, { recursive: true });
// props as a file: inline JSON quoting differs between cmd, PowerShell and bash
writeFileSync(`${out}/props.json`, JSON.stringify({ slug }));
const props = `--props=${out}/props.json`;

run("node scripts/fetch-sfx.mjs"); // Mixkit SFX are fetched, not committed
if (!rest.includes("--skip-voice")) run(`python scripts/voice.py ${slug}`);
else {
  // visual-only edits (labels, grounds, text) flow into the manifest; narration changes need a re-voice
  const mPath = `public/episodes/${slug}/manifest.json`;
  const m = JSON.parse(readFileSync(mPath, "utf8"));
  const ep = JSON.parse(readFileSync(`episodes/${slug}.json`, "utf8"));
  if (ep.scenes.length !== m.scenes.length || ep.scenes.some((s, i) => s.narration !== m.scenes[i].narration)) {
    console.error("narration changed since the last voice run: drop --skip-voice");
    process.exit(1);
  }
  m.scenes = m.scenes.map((s, i) => ({ ...ep.scenes[i], frames: s.frames, durationMs: s.durationMs, captions: s.captions }));
  writeFileSync(mPath, JSON.stringify(m, null, 2));
}
run(`python scripts/music.py ${slug}`);

const comps = format === "both" ? ["Short", "Long"] : [format === "short" ? "Short" : "Long"];
for (const comp of comps) {
  const file = `${out}/${slug}-${comp.toLowerCase()}.mp4`;
  const raw = `${out}/_raw-${comp.toLowerCase()}.mp4`;
  run(`npx remotion render ${comp} ${raw} ${props} --crf=16`);
  // master to -14 LUFS / -1.5 dBTP (social-platform loudness); picture is copied untouched
  run(`ffmpeg -v error -y -i ${raw} -c:v copy -af loudnorm=I=-14:TP=-2:LRA=11 -ar 48000 -c:a aac -b:a 192k ${file}`);
  rmSync(raw);
  // 1 frame per second, tiled, for review
  const scale = comp === "Short" ? "216:-1" : "384:-1";
  run(`ffmpeg -v error -y -i ${file} -vf "fps=1,scale=${scale},tile=8x6" -frames:v 1 ${out}/sheet-${comp.toLowerCase()}.png`);
}
run(`npx remotion still Thumbnail ${out}/thumbnail.png ${props}`);
console.log(`\nDone: ${out}/`);
