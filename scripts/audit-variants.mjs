// Selects each option choice of a modelled product and captures the front of the piece at 2x, so printed labels can be
// read. Records which choice the page reports as selected next to every image.
// Usage: node scripts/audit-variants.mjs <outDir> [id,id,...]    (dev server on :3111; reduced motion, front-facing)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const [out, idArg] = process.argv.slice(2);
if (!out) throw new Error('usage: node scripts/audit-variants.mjs <outDir> [ids]');
fs.mkdirSync(out, { recursive: true });
const ids = (idArg || 'espresso,latte,americano,cappuccino,spanish-latte,iced-latte,iced-matcha').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-variants-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto(process.env.BASE || 'http://localhost:3111', { waitUntil: 'domcontentloaded' });
await sleep(4000);
const report = [];
for (const id of ids) {
  await page.evaluate(() => { location.hash = ''; });
  await sleep(300);
  await page.evaluate((id) => { location.hash = '#shop/' + id; }, id);
  await page.waitForFunction(() => document.querySelector('#pdp-name')?.textContent, { timeout: 15000 });
  await sleep(2500);
  await page.evaluate(() => document.querySelector('[data-view="3d"]')?.click());
  await page.waitForFunction(() => document.querySelector('.pdp-stage canvas') && !document.querySelector('.pdp-stage .pcard-loading'), { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-opt]')].map((o) => [o.dataset.opt, [...o.querySelectorAll('[data-choice]')].map((c) => c.firstChild.textContent.trim())]));
  const stage = await page.$('.pdp-stage');
  const b = await stage.boundingBox();
  const clip = process.env.WIDE === '1' ? { x: b.x, y: b.y, width: b.width, height: b.height } : { x: b.x + b.width * 0.2, y: b.y + b.height * 0.08, width: b.width * 0.6, height: b.height * 0.72 };
  const shoot = async (name, entry) => {
    await page.screenshot({ path: path.join(out, name + '.png'), clip });
    report.push({ id, shot: name, ...entry });
  };
  await shoot(`${id}-default`, { selected: await page.evaluate(() => [...document.querySelectorAll('[data-opt] [aria-checked="true"]')].map((c) => c.firstChild.textContent.trim())) });
  for (const [key, labels] of opts) for (let c = 0; c < labels.length; c++) {
    await page.evaluate((k, c) => document.querySelector(`[data-opt="${k}"] [data-choice="${c}"]`)?.click(), key, c);
    await sleep(1000);
    const selected = await page.evaluate((k) => document.querySelector(`[data-opt="${k}"] [aria-checked="true"]`)?.firstChild.textContent.trim(), key);
    await shoot(`${id}-${key}-${c}`, { option: key, clicked: labels[c], selected, canvases: await page.evaluate(() => document.querySelectorAll('.pdp-stage canvas').length) });
  }
  console.log(id, 'ok', opts.map((o) => o[0]).join(','));
}
fs.writeFileSync(path.join(out, 'variants.json'), JSON.stringify(report, null, 1));
await browser.close();
