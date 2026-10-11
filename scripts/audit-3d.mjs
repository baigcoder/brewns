// Renders every product's photo and each 3D treatment its tab offers, and records what the page actually showed.
//   modelled piece at 0 / 90 / 180 degrees, photo relief at 0, and (with VARIANTS=1) every option choice on the model.
// A product only counts as captured if its detail page is open (#pdp-name matches the catalogue) and the requested view
// button is pressed before each shot; anything else is written to index.jsonl as a failure, never as a screenshot.
// Usage: node scripts/audit-3d.mjs <outDir> [width=1440] [id,id,...]    env: BASE, BROWSER, POLICY=1 (shipped behaviour), VARIANTS=1, REDUCED=0 (default is reduced motion, so no intro or idle spin), TOUCH=1
// The dev server must be running (default http://localhost:3111).
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const [out, widthArg, idArg] = process.argv.slice(2);
if (!out) throw new Error('usage: node scripts/audit-3d.mjs <outDir> [width] [ids]');
const width = Number(widthArg || 1440);
const POLICY = process.env.POLICY === '1'; // shipped behaviour: no forced mode, one pass through whatever tab the product offers
const BASE = process.env.BASE || 'http://localhost:3111';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });

// id -> name from the catalogue, so the page title can be checked against it.
const catalog = fs.readFileSync(new URL('../lib/catalog.ts', import.meta.url), 'utf8');
const names = new Map([...catalog.matchAll(/id: "([a-z0-9-]+)", name: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const ids = idArg ? idArg.split(',') : [...names.keys()];

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-audit-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
let page;
const touch = process.env.TOUCH === '1' || width < 700;
const errors = [];
// A fresh page, also used to recover when the dev server reloads or crashes the current one mid-run.
const freshPage = async () => {
  await page?.close().catch(() => {});
  page = await browser.newPage();
  await page.setViewport({ width, height: width < 700 ? 800 : width >= 1900 ? 1080 : 900, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  if (process.env.REDUCED !== '0') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (process.env.NOWEBGL === '1') await page.evaluateOnNewDocument(() => { HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : Object.getPrototypeOf(this).getContext.call(this, t, ...a); }; });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
};
await freshPage();

const log = (r) => fs.appendFileSync(path.join(out, 'index.jsonl'), JSON.stringify(r) + '\n');
const shot = async (name) => {
  const el = await page.$('.pdp-media');
  await el.screenshot({ path: path.join(out, name + '.png') });
  return name;
};
const pressed = (v) => page.evaluate((v) => document.querySelector(`[data-view="${v}"]`)?.getAttribute('aria-pressed') === 'true', v);
const labels = () => page.evaluate(() => [...document.querySelectorAll('.pdp-view')].map((b) => b.textContent.trim()));
const setView = async (v) => {
  await page.evaluate((v) => document.querySelector(`[data-view="${v}"]`)?.click(), v);
  for (let i = 0; i < 20 && !(await pressed(v)); i++) await sleep(100);
  return pressed(v);
};
const stageReady = async () => {
  await page.waitForFunction(() => document.querySelector('.pdp-stage canvas') && !document.querySelector('.pdp-stage .pcard-loading'), { timeout: 20000 }).catch(() => {});
  await sleep(1500);
};
const drag = async (dx) => {
  const b = await (await page.$('.pdp-stage canvas')).boundingBox();
  const x = b.x + b.width / 2 - dx / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 8 });
  await page.mouse.up();
  await sleep(500);
};
const open = async (id) => {
  await page.evaluate(() => { location.hash = ''; });
  await sleep(300);
  await page.evaluate((id, policy) => { window.__viewMode = policy ? undefined : 'model'; location.hash = '#shop/' + id; }, id, POLICY);
  for (let i = 0; i < 30; i++) {
    const name = await page.evaluate(() => document.querySelector('#pdp-name')?.textContent?.trim());
    if (name === names.get(id)) return true;
    await sleep(200);
  }
  return false;
};

for (const id of ids) for (let attempt = 0; attempt < 2; attempt++) {
  const r = { id, name: names.get(id), width, shots: [], fail: [] };
  try {
    if (!(await open(id))) { r.fail.push('detail page did not open'); log(r); console.log(id, 'FAIL open'); break; }
    await sleep(2500);
    r.labels = await labels();
    r.shots.push(await shot(`${id}-photo`));
    if (!r.labels.some((l) => /3D|TILT/.test(l))) { r.tab = 'none'; log(r); console.log(id, 'photo only', r.labels); break; }
    for (const mode of POLICY ? ['shipped'] : ['model', 'relief']) {
      if (!POLICY) await page.evaluate((mode) => { window.__viewMode = mode; }, mode);
      await setView('photo');
      await sleep(200);
      if (!(await setView('3d'))) { r.fail.push(mode + ': 3d button never pressed'); continue; }
      await stageReady();
      if (!(await page.$('.pdp-stage canvas'))) { r.fail.push(mode + ': no canvas'); continue; }
      r.shots.push(await shot(`${id}-${mode}-0`));
      if (POLICY) { r.hint = await page.evaluate(() => document.querySelector('#pdp-hint')?.textContent); r.aria = await page.evaluate(() => document.querySelector('.pdp-stage canvas')?.getAttribute('aria-label')); }
      if (mode === 'model' || (POLICY && /3D VIEW/.test(r.labels.join()))) {
        for (const a of [90, 180]) { await drag(157); r.shots.push(await shot(`${id}-${mode}-${a}`)); }
        if (process.env.VARIANTS === '1') {
          const opts = await page.evaluate(() => [...document.querySelectorAll('[data-opt]')].map((o) => [o.dataset.opt, o.querySelectorAll('[data-choice]').length]));
          for (const [key, n] of opts) for (let c = 0; c < n; c++) {
            await page.evaluate((k, c) => document.querySelector(`[data-opt="${k}"] [data-choice="${c}"]`)?.click(), key, c);
            await sleep(900);
            r.shots.push(await shot(`${id}-var-${key}-${c}`));
          }
        }
      }
      await setView('photo');
    }
  } catch (e) { r.fail.push(String(e).slice(0, 200)); }
  if (r.fail.length && attempt === 0) { await freshPage(); continue; }
  log(r);
  console.log(id, r.shots.length, r.fail.length ? 'FAIL ' + r.fail.join('; ') : 'ok');
  break;
}
fs.writeFileSync(path.join(out, 'errors.json'), JSON.stringify([...new Set(errors)].slice(0, 20), null, 1));
console.log('console errors:', new Set(errors).size);
await browser.close();
