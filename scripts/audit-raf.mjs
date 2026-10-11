// Which requestAnimationFrame callbacks run, and how often, in each page state? Groups callbacks by the source line of
// the call that scheduled them, so loops can be attributed to code. Usage: node scripts/audit-raf.mjs   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import path from 'path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-raf-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: process.env.MOTION === '1' ? 'no-preference' : 'reduce' }]);
await page.evaluateOnNewDocument(() => {
  window.__raf = {};
  const r = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => {
    const where = (new Error().stack || '').split('\n').slice(2, 4).map((l) => l.replace(/^\s*at\s+/, '').replace(/\(?https?:\/\/[^/]+/, '(').trim()).join(' <- ');
    window.__raf[where] = (window.__raf[where] || 0) + 1;
    return r(f);
  };
});
await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' });
await sleep(5000);
const sample = async (label, ms = 3000) => {
  await page.evaluate(() => (window.__raf = {}));
  await sleep(ms);
  const m = await page.evaluate(() => window.__raf);
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${(v / (ms / 1000)).toFixed(1).padStart(6)}/s  ${k.slice(0, 150)}`);
  console.log(`== ${label}\n${rows.join('\n') || '   (none)'}`);
};
await sample('shop page, no product open');
await page.evaluate(() => (location.hash = '#shop/espresso'));
await sleep(3000);
await sample('product open, Photo view');
await page.evaluate(() => document.querySelector('[data-view="3d"]').click());
await sleep(3000);
await sample('product open, 3D view');
await page.evaluate(() => document.querySelector('[data-view="photo"]').click());
await sleep(1500);
await sample('back on Photo view');
await page.evaluate(() => (location.hash = ''));
await sleep(1500);
await sample('product closed again');
// CPU cost of each state: main-thread task time per wall-clock second (headless, software WebGL, so a ceiling).
const cpu = async (label, ms = 4000) => {
  const m0 = await page.metrics();
  await sleep(ms);
  const m1 = await page.metrics();
  console.log(`cpu ${label.padEnd(28)} ${(((m1.TaskDuration - m0.TaskDuration) / (ms / 1000)) * 100).toFixed(1)}% of one core`);
};
await page.evaluate(() => (location.hash = ''));
await sleep(1500);
await cpu('shop page, viewer closed');
await page.evaluate(() => (location.hash = '#shop/espresso'));
await sleep(2500);
await cpu('product, Photo view');
await page.evaluate(() => document.querySelector('[data-view="3d"]').click());
await sleep(2500);
await cpu('product, 3D (reduced motion)');
await browser.close();
