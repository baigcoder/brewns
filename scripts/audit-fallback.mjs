// For each product: with WebGL unavailable, does the 3D tab leave the photograph and a message on the stage, and does
// the Photo button still work? With the shared model file blocked, does the viewer still render (procedural pieces) or
// fall back cleanly? Usage: node scripts/audit-fallback.mjs <id,id,...>   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import path from 'path';
const ids = (process.argv[2] || '').split(',').filter(Boolean);
if (!ids.length) throw new Error('usage: node scripts/audit-fallback.mjs <ids>');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-fallback-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const state = (page) => page.evaluate(() => ({ canvas: !!document.querySelector('.pdp-stage canvas'), photo: !!document.querySelector('.pdp-stage img.pdp-photo'), status: document.querySelector('.pdp-stage [role=status]')?.textContent || null, name: document.querySelector('#pdp-name')?.textContent }));
for (const mode of ['noWebGL', 'glbBlocked']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  if (mode === 'noWebGL') await page.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
  else { await page.setRequestInterception(true); page.on('request', (r) => (/models\.glb/.test(r.url()) ? r.abort() : r.continue())); }
  await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  for (const id of ids) {
    await page.evaluate(() => (location.hash = ''));
    await sleep(250);
    await page.evaluate((id) => (location.hash = '#shop/' + id), id);
    await page.waitForFunction(() => document.querySelector('#pdp-name')?.textContent, { timeout: 15000 });
    await sleep(1500);
    await page.evaluate(() => document.querySelector('[data-view="3d"]')?.click());
    await sleep(3500);
    const s = await state(page);
    await page.evaluate(() => document.querySelector('[data-view="photo"]')?.click());
    await sleep(800);
    const back = await page.evaluate(() => !!document.querySelector('.pdp-stage img.pdp-photo'));
    const ok = mode === 'noWebGL' ? !s.canvas && s.photo && !!s.status && back : (s.canvas || (s.photo && !!s.status)) && back;
    console.log(mode.padEnd(10), id.padEnd(18), ok ? 'pass' : 'FAIL', JSON.stringify({ ...s, back }));
  }
  await page.close();
}
await browser.close();
