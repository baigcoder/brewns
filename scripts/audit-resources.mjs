// Opens and closes the 3D / tilt viewer repeatedly and switches products and variants, then reports what is left behind:
// canvases, live WebGL contexts (counted by wrapping getContext and the WEBGL_lose_context extension), requestAnimationFrame
// callbacks per second while the viewer is closed, and JS heap after a forced GC. Evidence, not proof: a flat heap over
// N cycles on one machine does not show the absence of every leak.
// Usage: node scripts/audit-resources.mjs [cycles=15]   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import path from 'path';
const cycles = Number(process.argv[2] || 15);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-res-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.evaluateOnNewDocument(() => {
  window.__ctx = new Set();
  const g = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = g.call(this, t, ...a); if (c && /webgl/i.test(t)) window.__ctx.add(this); return c; };
  window.__raf = 0; const r = window.requestAnimationFrame; window.requestAnimationFrame = (f) => { window.__raf++; return r(f); };
});
await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' });
await sleep(4000);
const state = () => page.evaluate(async () => {
  window.gc?.(); await new Promise((r) => setTimeout(r, 300)); window.gc?.();
  const live = [...window.__ctx].filter((c) => c.isConnected).length;
  return { canvasesInDom: document.querySelectorAll('.pdp-stage canvas').length, glCanvasesConnected: live, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) };
});
const rafRate = async () => { const a = await page.evaluate(() => window.__raf); await sleep(2000); return ((await page.evaluate(() => window.__raf)) - a) / 2; };
const open = async (id) => { await page.evaluate((id) => (location.hash = '#shop/' + id), id); await page.waitForFunction((id) => document.querySelector('#pdp-name'), {}, id); await sleep(700); };
const view = async (v) => { await page.evaluate((v) => document.querySelector(`[data-view="${v}"]`)?.click(), v); await sleep(1500); };
const close = async () => { await page.evaluate(() => (location.hash = '')); await sleep(900); };
const out = { cycles, samples: [] };
out.baseline = await state(); out.rafBaseline = await rafRate();
const ids = (process.env.IDS || 'espresso,smash-burger,americano,slow-roast').split(',');
for (let i = 0; i < cycles; i++) {
  const id = ids[i % ids.length];
  await open(id); await view('3d');
  if (i % 2) await page.evaluate(() => document.querySelector('[data-opt] [data-choice="1"]')?.click());
  await sleep(600); await close();
  if (i % 5 === 4) out.samples.push({ cycle: i + 1, ...(await state()) });
}
await sleep(1500);
out.final = await state(); out.rafAfterClose = await rafRate();
// one viewer open: how busy is it, and does it stop when the tab is hidden?
await open('espresso'); await view('3d'); out.rafWhileOpen = await rafRate();
await page.evaluate(() => document.querySelector('[data-view="photo"]').click()); await sleep(1500); out.rafPhotoTab = await rafRate();
console.log(JSON.stringify(out, null, 1));
await browser.close();
