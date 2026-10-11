// Original photograph beside the real 3D model at 0, 90, 180 and 270 degrees (2x, tight crop), forcing the model view
// even for products the policy still shows as relief. Writes <id>-photo.png, <id>-m0/90/180/270.png and index.jsonl for
// audit-strips. Usage: node scripts/audit-compare.mjs <outDir> <id,id,...>   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const [out, idArg] = process.argv.slice(2);
if (!out || !idArg) throw new Error('usage: node scripts/audit-compare.mjs <outDir> <ids>');
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-compare-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto(process.env.BASE || 'http://localhost:3111', { waitUntil: 'domcontentloaded' });
await sleep(4000);
const rows = [];
for (const id of idArg.split(',')) {
  await page.evaluate(() => { location.hash = ''; });
  await sleep(300);
  await page.evaluate((id) => { window.__viewMode = 'model'; location.hash = '#shop/' + id; }, id);
  await page.waitForFunction(() => document.querySelector('#pdp-name')?.textContent, { timeout: 15000 });
  await sleep(2500);
  const stage = await page.$('.pdp-stage');
  const b = await stage.boundingBox();
  const clip = { x: b.x + b.width * 0.15, y: b.y + b.height * 0.06, width: b.width * 0.7, height: b.height * 0.8 };
  const shot = async (n) => { await page.screenshot({ path: path.join(out, `${id}-${n}.png`), clip }); return `${id}-${n}`; };
  const shots = [await shot('photo')];
  await page.evaluate(() => document.querySelector('[data-view="3d"]')?.click());
  await page.waitForFunction(() => document.querySelector('.pdp-stage canvas') && !document.querySelector('.pdp-stage .pcard-loading'), { timeout: 25000 }).catch(() => {});
  await sleep(1800);
  const cb = await (await page.$('.pdp-stage canvas')).boundingBox();
  for (const a of [0, 90, 180, 270]) {
    if (a) {
      const x = cb.x + cb.width / 2 - 78, y = cb.y + cb.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 157, y, { steps: 8 }); await page.mouse.up(); await sleep(600);
    }
    shots.push(await shot('m' + a));
  }
  rows.push({ id, shots });
  console.log(id, 'ok');
}
fs.writeFileSync(path.join(out, 'index.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
await browser.close();
