// For every product with a 3D view and every option group: does choosing each value change what the viewer renders?
// Renders the stage with each choice (reduced motion, nothing dragged), and compares it with the product's first choice
// pixel by pixel. A value whose image differs from every other value's by under THRESH of pixels is reported as "no visible
// change". Usage: node scripts/audit-optdiff.mjs <out.json> [ids]   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const [out, idArg] = process.argv.slice(2);
if (!out) throw new Error('usage: node scripts/audit-optdiff.mjs <out.json> [ids]');
const THRESH = Number(process.env.THRESH || 0.0015);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const catalog = fs.readFileSync(new URL('../lib/catalog.ts', import.meta.url), 'utf8');
const ids = idArg ? idArg.split(',') : [...catalog.matchAll(/id: "([a-z0-9-]+)", name: "/g)].map((m) => m[1]);
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-optdiff-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' });
await sleep(4000);
const diff = (a, b) => page.evaluate(async (a, b) => {
  const load = async (x) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + x)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
  const A = await load(a), B = await load(b);
  let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 36) n++;
  return n / (A.length / 4);
}, a, b);
const report = [];
for (const id of ids) {
  await page.evaluate(() => (location.hash = ''));
  await sleep(250);
  await page.evaluate((id) => (location.hash = '#shop/' + id), id);
  await page.waitForFunction(() => document.querySelector('#pdp-name')?.textContent, { timeout: 15000 });
  await sleep(1500);
  if (!(await page.$('[data-view="3d"]'))) continue;
  await page.evaluate(() => document.querySelector('[data-view="3d"]').click());
  await page.waitForFunction(() => document.querySelector('.pdp-stage canvas') && !document.querySelector('.pdp-stage .pcard-loading'), { timeout: 25000 }).catch(() => {});
  await sleep(1800);
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-opt]')].map((o) => [o.dataset.opt, [...o.querySelectorAll('[data-choice]')].map((c) => c.firstChild.textContent.trim())]));
  for (const [key, labels] of opts) {
    const shots = [];
    for (let c = 0; c < labels.length; c++) {
      await page.evaluate((k, c) => document.querySelector(`[data-opt="${k}"] [data-choice="${c}"]`)?.click(), key, c);
      await sleep(1100);
      shots.push((await (await page.$('.pdp-stage')).screenshot()).toString('base64'));
    }
    const rows = [];
    for (let c = 0; c < labels.length; c++) {
      let best = 0;
      for (let d = 0; d < labels.length; d++) if (d !== c) best = Math.max(best, await diff(shots[c], shots[d]));
      rows.push({ choice: labels[c], maxDiffVsOthers: +best.toFixed(4), visible: best >= THRESH });
    }
    const r = { id, option: key, rows, anyVisible: rows.some((x) => x.visible), allVisible: rows.every((x) => x.visible) };
    report.push(r);
    console.log(id.padEnd(18), key.padEnd(8), r.allVisible ? 'all values differ' : r.anyVisible ? 'some values look the same: ' + rows.filter((x) => !x.visible).map((x) => x.choice).join(' | ') : 'NO VISIBLE CHANGE');
  }
}
fs.writeFileSync(out, JSON.stringify(report, null, 1));
await browser.close();
