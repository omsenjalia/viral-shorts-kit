// capture.mjs: screenshot real public pages as b-roll for an episode (adapted from shotcraft's capture-template.mjs).
//
//   node scripts/capture.mjs <slug> <url> [<url>...]
//
// Writes to public/episodes/<slug>/shots/, per URL (<name> = host, e.g. noqta-tn):
//   <name>-full.png    2x full page at a 1280-wide desktop viewport
//   <name>-hero.png    2x first viewport (1280x800)
//   <name>-mobile.png  3x full page at a 430-wide mobile viewport (3x so a vertical close-up on the headline stays sharp)
//   shots.json         every file's pixel size and bytes, plus bboxes (CSS px, page coords) of the h1
//                      (with per-word rects for highlighting), the hero image, code blocks and date text near the top, per layout.
//
// Uses puppeteer-core with the Chrome Headless Shell Remotion already downloaded (`npx remotion browser ensure`).
// Consent banners: clicks a "reject / necessary only" button if there is one, then hides what's left of the overlay.
// It never types, logs in or accepts anything, and leaves the page content itself alone.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const [slug, ...urls] = process.argv.slice(2);
if (!slug || !urls.length || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: node scripts/capture.mjs <slug> <url> [<url>...]   (slug: a-z 0-9 -)');
  process.exit(1);
}
for (const u of urls) if (!/^https?:\/\//.test(u)) throw new Error(`not an http(s) URL: ${u}`);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'episodes', slug, 'shots');
fs.mkdirSync(outDir, { recursive: true });

const shellDir = path.join(root, 'node_modules', '.remotion', 'chrome-headless-shell');
const findExe = (dir) => {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findExe(p); if (r) return r; }
    else if (/^chrome-headless-shell(\.exe)?$/.test(e.name)) return p;
  }
  return null;
};
const executablePath = findExe(shellDir);
if (!executablePath) throw new Error(`no Chrome Headless Shell under ${shellDir}: run \`npx remotion browser ensure\``);

const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 2 };
const MOBILE = { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// shortcut: full pages are clipped at 16000 device px (Chrome's ~16k texture limit); add tiling if a shot needs deeper scroll.
const maxCssH = (v) => Math.floor(16000 / v.deviceScaleFactor);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--hide-scrollbars', '--no-first-run'] });
const desktopUA = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
const mobileUA = desktopUA.replace(/\(.*?\)/, '(Linux; Android 14; Pixel 8)').replace(/Safari\//, 'Mobile Safari/');

// Click the privacy-preserving choice in any frame; a short exact-ish label only, so article links are never hit.
const DECLINE = /^(reject( all)?( cookies)?|decline( all)?|refuse( all)?|deny( all)?|disagree|do not (accept|consent)|(only|use) (strictly )?(necessary|essential)( cookies)?( only)?|(strictly )?(necessary|essential) (cookies )?only|continue without (accepting|agreeing))$/i;
const declineCookies = async (page) => {
  let clicked = 0;
  for (const frame of page.frames()) {
    try {
      clicked += await frame.evaluate((src) => {
        const re = new RegExp(src, 'i');
        const els = [...document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]')];
        const hit = els.find((el) => {
          const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
          const r = el.getBoundingClientRect();
          return t.length < 48 && re.test(t) && r.width > 0 && r.height > 0;
        });
        if (hit) { hit.click(); return 1; }
        return 0;
      }, DECLINE.source);
    } catch { /* detached / cross-origin frame we can't reach */ }
  }
  return clicked;
};

// Hide whatever consent overlay is left (by name, or a fixed layer covering most of the viewport) and unlock scrolling.
const hideOverlays = (page) =>
  page.evaluate(() => {
    const NAME = /cookie|consent|gdpr|ccpa|cmp|onetrust|didomi|cookiebot|usercentrics|truste|quantcast|sp_message|privacy-?banner/i;
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      const named = NAME.test(`${el.id} ${el.className?.baseVal ?? el.className} ${el.getAttribute('aria-label') ?? ''}`);
      const blocking = cs.position === 'fixed' && r.width * r.height > innerWidth * innerHeight * 0.6 && el.querySelectorAll('h1, article').length === 0;
      if (named || blocking) { el.style.setProperty('display', 'none', 'important'); n++; }
    }
    for (const el of [document.documentElement, document.body]) {
      if (getComputedStyle(el).overflow === 'hidden') el.style.setProperty('overflow', 'visible', 'important');
    }
    return n;
  });

// Scroll top→bottom so lazy images and scroll-triggered content load, then back to the top.
const scrollThrough = async (page) => {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 60; y += innerHeight * 0.8, i++) {
      scrollTo(0, y);
      await wait(180);
    }
    scrollTo(0, 0);
  });
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 12000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((im) => !im.complete).map((im) => new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 5000); })));
  });
  await sleep(500);
};

// Boxes in page coordinates (CSS px): h1 + per-word rects, the hero image, code blocks.
const measure = (page) =>
  page.evaluate(() => {
    const box = (r) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
    const h1el = [...document.querySelectorAll('h1')].find(visible);
    let h1 = null;
    if (h1el) {
      const words = [];
      const walk = document.createTreeWalker(h1el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        for (const m of n.textContent.matchAll(/\S+/g)) {
          const rg = document.createRange();
          rg.setStart(n, m.index);
          rg.setEnd(n, m.index + m[0].length);
          const rs = [...rg.getClientRects()].filter((r) => r.width > 0);
          if (rs.length) words.push({ text: m[0], ...box(rs[0]) });
        }
      }
      h1 = { text: h1el.innerText.trim().replace(/\s+/g, ' '), ...box(h1el.getBoundingClientRect()), words };
    }
    // hero: the largest image/video whose top sits in the first 1.6 viewports
    const media = [...document.querySelectorAll('img, picture, video, svg[role="img"]')]
      .filter((el) => visible(el) && el.getBoundingClientRect().top + scrollY < innerHeight * 1.6)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= innerWidth * 0.3 && r.height >= 120)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    const hero = media[0] ? box(media[0].r) : null;
    const code = [...document.querySelectorAll('pre')].filter(visible).slice(0, 16).map((el) => box(el.getBoundingClientRect()));
    // dates in the top 1.6 viewports (exact text ranges), so an old story's date can be masked in the video
    const DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b|\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])(?:[-/.]\d{1,2})?\b/gi;
    const dates = [];
    // match per element (frameworks split "Apr 18, 2026" over several text nodes), on the deepest element holding the whole match
    for (const el of document.body.querySelectorAll('*')) {
      const t = el.textContent;
      if (!t || t.length > 300 || !visible(el) || el.getBoundingClientRect().top + scrollY > innerHeight * 1.6) continue;
      for (const m of t.matchAll(DATE)) {
        if ([...el.children].some((c) => c.textContent.includes(m[0]))) continue;
        const nodes = [];
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(), off = 0; n; off += n.textContent.length, n = tw.nextNode()) nodes.push({ n, off });
        const at = (i) => { const k = nodes.findLast((x) => x.off <= i); return [k.n, i - k.off]; };
        const rg = document.createRange();
        rg.setStart(...at(m.index));
        rg.setEnd(...at(m.index + m[0].length - 1));
        rg.setEnd(rg.endContainer, rg.endOffset + 1);
        for (const r of rg.getClientRects()) if (r.width > 0 && dates.length < 24) dates.push({ text: m[0], ...box(r) });
      }
    }
    return { title: document.title, pageH: document.documentElement.scrollHeight, h1, hero, code, dates };
  });

// PNG IHDR → pixel size (also the self-check that the file is a real PNG).
const pngSize = (file) => {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
};

const prepare = async (page, url, viewport, ua) => {
  await page.setUserAgent(ua);
  await page.setViewport(viewport);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch (e) {
    if (!/timeout/i.test(e.message)) throw e;
    console.log('  (network never idled, continuing)');
  }
  await sleep(1200); // consent managers inject late
  const declined = await declineCookies(page);
  if (declined) await sleep(900);
  const hidden = await hideOverlays(page);
  await scrollThrough(page);
  const hidden2 = await hideOverlays(page); // some banners only appear after scrolling
  console.log(`  consent: ${declined ? 'declined' : 'no decline button'}, ${hidden + hidden2} overlay(s) hidden`);
  return measure(page);
};

const shoot = async (page, file, cssW, cssH, scale) => {
  const p = path.join(outDir, file);
  await page.screenshot({ path: p, clip: { x: 0, y: 0, width: cssW, height: cssH }, captureBeyondViewport: true });
  const s = pngSize(p);
  console.log(`  ${file}  ${s.w}x${s.h}  ${(s.bytes / 1024).toFixed(0)} KB`);
  if (s.w !== cssW * scale) throw new Error(`${file}: expected ${cssW * scale}px wide, got ${s.w}`);
  return { file, ...s, cssW, cssH, scale };
};

const manifestPath = path.join(outDir, 'shots.json');
const manifest = { slug, pages: [] };
const used = new Set();
for (const url of urls) {
  let name = new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  for (let i = 2; used.has(name); i++) name = `${name.replace(/-\d+$/, '')}-${i}`;
  used.add(name);
  console.log(`${url} → ${name}`);
  const page = await browser.newPage();
  try {
    const desktop = await prepare(page, url, DESKTOP, desktopUA);
    const hero = await shoot(page, `${name}-hero.png`, DESKTOP.width, DESKTOP.height, 2);
    const full = await shoot(page, `${name}-full.png`, DESKTOP.width, Math.min(desktop.pageH, maxCssH(DESKTOP)), 2);
    const mobile = await prepare(page, url, MOBILE, mobileUA);
    const mob = await shoot(page, `${name}-mobile.png`, MOBILE.width, Math.min(mobile.pageH, maxCssH(MOBILE)), 3);
    if (!desktop.h1) console.log('  ! no visible h1 found: use focus fractions instead of "h1"');
    const strip = ({ title, ...rest }) => rest;
    manifest.pages.push({ url, name, title: desktop.title, files: { full, hero, mobile: mob }, desktop: strip(desktop), mobile: strip(mobile) });
  } finally {
    await page.close();
  }
}
await browser.close();

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log('wrote', path.relative(root, manifestPath));
