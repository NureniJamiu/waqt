// Renders the Waqt product film frame by frame.
//
// The real app (built into .app/) is served next to stage.html. Its toast and
// overlay screens run inside the stage as iframes, and Playwright's fake clock
// drives every timer, so the countdowns on screen are the app's own.
//
//   node render.mjs                 all frames -> frames/f00000.jpg ...
//   node render.mjs --at 10,20,45   preview stills -> work/preview-<t>.jpg
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const app = path.join(here, '.app');
const FPS = 30;
const atArg = process.argv.indexOf('--at');
const stills = atArg > 0 ? process.argv[atArg + 1].split(',').map(Number) : null;
// --from <seconds>: re-shoot only frames from this time on, keeping earlier ones in frames/
const fromArg = process.argv.indexOf('--from');
const fromT = fromArg > 0 ? Number(process.argv[fromArg + 1]) : 0;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = p === '/stage.html' ? path.join(here, 'stage.html') : p.startsWith('/vo/') ? path.join(here, p) : path.join(app, p);
  if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

// Lagos, Thursday 15 Oct 2026: Dhuhr 12:33, lock 12:23, pause ends 12:38.
const at = (s) => new Date(`2026-10-15T${s}+01:00`).getTime();
const LOCK = at('12:23:00');

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'Africa/Lagos', locale: 'en-GB' });
const page = await ctx.newPage();
await page.clock.install({ time: at('12:17:51') });
await page.clock.pauseAt(at('12:17:51'));
await page.goto(`${base}/stage.html`);
await page.evaluate(() => document.fonts.ready);
const TL = await page.evaluate(() => window.TL);
const now = () => page.evaluate(() => Date.now());

async function load(id, url) {
  await page.evaluate(([id, url]) => { document.getElementById(id).src = url; }, [id, url]);
  await page.frameLocator(`#${id}`).locator('#root > *').first().waitFor({ timeout: 20000 });
  await page.evaluate((id) => {
    const d = document.getElementById(id).contentDocument;
    d.documentElement.style.background = 'transparent';
    d.body.style.background = 'transparent';
    d.body.style.backgroundImage = 'none';
  }, id);
  await page.clock.runFor(60);
}
async function setTime(target) {
  const d = target - (await now());
  if (d > 0) await page.clock.fastForward(d);
}

// What the clock should do on the way to time t.
const done = new Set();
async function step(t) {
  const once = async (k, fn) => { if (!done.has(k)) { done.add(k); await fn(); } };
  const dt = 1000 / FPS;
  if (t >= TL.ffStart && t < TL.toast) {
    // time-skip from 12:18 to 12:22:50 while the work carries on
    const p = (t - TL.ffStart) / (TL.toast - TL.ffStart);
    const target = at('12:18:05') + p * (at('12:22:50') - at('12:18:05'));
    const d = target - (await now());
    if (d > 0) await page.clock.runFor(d);
    return;
  }
  if (t >= TL.toast) await once('toast', async () => { await setTime(at('12:22:50')); await load('toast', '/?screen=toast&prayer=Dhuhr'); });
  if (t >= TL.lock) await once('lock', async () => {
    await setTime(LOCK);
    await load('ov1', `/?screen=overlay&prayer=Dhuhr&started_at=${LOCK}`);
    await load('ov2', `/?screen=overlay&prayer=Dhuhr&started_at=${LOCK}`);
  });
  if (t >= TL.plugCover - 0.3) await once('ov3', () => load('ov3', `/?screen=overlay&prayer=Dhuhr&started_at=${LOCK}`));
  if (t >= TL.lapse && t < TL.lapseEnd) {
    const p = (t - TL.lapse) / (TL.lapseEnd - TL.lapse);
    const start = LOCK + (TL.lapse - TL.lock) * 1000;
    const target = start + p * p * (at('12:38:01') - start);
    const d = target - (await now());
    if (d > 0) await page.clock.runFor(d);
    return;
  }
  if (t >= TL.lapseEnd) await once('open', async () => {
    await setTime(at('12:38:01'));
    await page.clock.runFor(1200);
    await page.evaluate(() => {
      const d = document.getElementById('ov1').contentDocument;
      const b = [...d.querySelectorAll('button')].find((x) => /I've Prayed/i.test(x.textContent));
      const r = b.getBoundingClientRect();
      window.BTN = { x: r.left + r.width * 0.55, y: r.top + r.height * 0.55 };
      window.BTN_EL = b;
    });
  });
  const rate = t >= TL.toast && t < TL.lock ? 10 / (TL.lock - TL.toast) : 1;
  await page.clock.runFor(dt * rate);
}

const frames = stills ? stills.map((s) => Math.round(s * FPS)) : [...Array(Math.round(TL.dur * FPS)).keys()].filter((f) => f >= Math.round(fromT * FPS));
fs.mkdirSync(path.join(here, stills ? 'work' : 'frames'), { recursive: true });
let last = 0;
for (const f of frames) {
  for (let g = last; g < f; g++) await step(g / FPS);
  last = f;
  const t = f / FPS;
  await page.evaluate((t) => {
    window.setScene(t);
    if (window.BTN_EL) window.BTN_EL.style.transform = t > window.TL.click && t < window.TL.click + 0.18 ? 'scale(0.97)' : '';
  }, t);
  const file = stills ? path.join(here, 'work', `preview-${t.toFixed(1)}.jpg`) : path.join(here, 'frames', `f${String(f).padStart(5, '0')}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 93 });
  if (!stills && f % 150 === 0) console.log(`frame ${f} / ${frames.length}`);
}

await browser.close();
server.close();
console.log('done');
