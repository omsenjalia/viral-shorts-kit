// Downloads the few Mixkit sound effects the hook/outro shots use into public/sfx/sc/.
// They are referenced, not redistributed: Mixkit's free license allows use in videos, not re-hosting the files.
// Sources and license: public/sfx/LICENSE.md. Runs automatically from build.mjs; skips files already present.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const FILES = {
  "whoosh-fast.mp3": "https://assets.mixkit.co/active_storage/sfx/1490/1490-preview.mp3",
  "bass-hit-short.mp3": "https://assets.mixkit.co/active_storage/sfx/2299/2299-preview.mp3",
  "impact-deep-whoosh.mp3": "https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3",
  "sparkle-touch.mp3": "https://assets.mixkit.co/active_storage/sfx/3083/3083-preview.mp3",
};

const dir = "public/sfx/sc";
mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(FILES)) {
  const path = `${dir}/${name}`;
  if (existsSync(path)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch-sfx: ${url} -> HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${path}`);
}
