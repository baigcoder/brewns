// Behaviour checks the screenshot audit cannot make: WebGL off, model file blocked, overflow, touch / keyboard / wheel, repeated switching.
// Usage: node scripts/audit-behaviour.mjs <outDir>   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import fs from 'fs'; import crypto from 'crypto';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: (process.env.TEMP || process.env.TMPDIR || '.') + '/brewns-behaviour-' + Date.now(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const res = {};
const hash = async (page) => crypto.createHash('md5').update(await (await page.$('.pdp-stage')).screenshot()).digest('hex');
async function open(page, id) { await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' }); await sleep(3500); await page.evaluate((id) => (location.hash = '#shop/' + id), id); await sleep(3000); }
async function threeD(page) { await page.evaluate(() => document.querySelector('[data-view="3d"]').click()); await page.waitForFunction(() => document.querySelector('.pdp-stage canvas'), { timeout: 20000 }).catch(() => {}); await sleep(2500); }

// 1. WebGL unavailable
{
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
  await open(page, 'espresso'); await threeD(page);
  res.noWebGL = await page.evaluate(() => ({ canvas: !!document.querySelector('.pdp-stage canvas'), photo: !!document.querySelector('.pdp-stage img.pdp-photo'), status: document.querySelector('.pdp-stage [role=status]')?.textContent, photoBtn: !!document.querySelector('[data-view="photo"]'), pageOpen: document.querySelector('#pdp-name')?.textContent }));
  await (await page.$('.pdp-media')).screenshot({ path: out + '/nowebgl-espresso.png' });
  await page.evaluate(() => document.querySelector('[data-view="photo"]').click()); await sleep(800);
  res.noWebGL.backToPhoto = await page.evaluate(() => !!document.querySelector('.pdp-stage img.pdp-photo'));
  await page.close();
}
// 2. model asset fails to load (block the glb)
{
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (/models\.glb/.test(r.url()) ? r.abort() : r.continue()));
  await open(page, 'espresso'); await threeD(page);
  res.glbBlocked = await page.evaluate(() => ({ canvas: !!document.querySelector('.pdp-stage canvas'), photo: !!document.querySelector('.pdp-stage img.pdp-photo'), status: document.querySelector('.pdp-stage [role=status]')?.textContent }));
  await (await page.$('.pdp-media')).screenshot({ path: out + '/glb-blocked-espresso.png' });
  await page.close();
}
// 3. overflow, touch, keyboard, wheel
for (const [w, touch] of [[320, true], [390, true], [1440, false]]) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: w < 700 ? 800 : 900, hasTouch: touch, isMobile: touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await open(page, 'espresso'); await threeD(page);
  const r = { overflowX: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
  const b = await (await page.$('.pdp-stage canvas')).boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const h0 = await hash(page);
  if (touch) { await page.touchscreen.touchStart(cx, cy); for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(cx + i * 15, cy); await page.touchscreen.touchEnd(); } else { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy, { steps: 8 }); await page.mouse.up(); }
  await sleep(800); const h1 = await hash(page); r.dragRotates = h0 !== h1;
  await page.focus('.pdp-stage canvas'); await page.keyboard.press('ArrowRight'); await sleep(800); const h2 = await hash(page); r.keyboardRotates = h1 !== h2;
  await page.keyboard.press('+'); await sleep(800); const h3 = await hash(page); r.keyZoom = h2 !== h3;
  if (!touch) { await page.mouse.move(cx, cy); await page.mouse.wheel({ deltaY: -300 }); await sleep(800); const h4 = await hash(page); r.wheelZoom = h3 !== h4; r.pageScrolledByWheel = await page.evaluate(() => scrollY); }
  r.afterReload3dButton = await page.evaluate(() => document.querySelector('[data-view="3d"]').getAttribute('aria-pressed'));
  res['w' + w] = r; await page.close();
}
// 4. rapid mode switching leaves exactly one canvas
{
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await open(page, 'americano');
  for (let i = 0; i < 6; i++) { await page.evaluate(() => document.querySelector('[data-view="3d"]').click()); await sleep(150); await page.evaluate(() => document.querySelector('[data-view="photo"]').click()); await sleep(150); }
  await page.evaluate(() => document.querySelector('[data-view="3d"]').click()); await sleep(3000);
  res.switching = await page.evaluate(() => ({ canvases: document.querySelectorAll('.pdp-stage canvas').length, pressed3d: document.querySelector('[data-view="3d"]').getAttribute('aria-pressed') }));
  await page.close();
}
console.log(JSON.stringify(res, null, 1)); await browser.close();
