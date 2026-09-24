/**
 * Renders the product pictures that come from the 3D packaging (the coffee
 * bags and cups) into public/assets/shop/snap/, so visitors load a small image
 * instead of rendering each one with WebGL on their phone.
 *
 * Re-run after changing the packaging (pdp3dEngine.ts or models.glb), then bump
 * SNAP_VERSION in initBrewns.ts so browsers fetch the new pictures.
 *
 * Needs the dev server running (bun run dev) and a Chrome or Chromium:
 *   bun run snapshots
 *   BREWNS_URL=http://localhost:3001 CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" bun run snapshots
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const url = process.env.BREWNS_URL || 'http://localhost:3000';
const chrome =
  process.env.CHROME_PATH ||
  [
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome found: set CHROME_PATH');

const out = path.join(process.cwd(), 'public/assets/shop/snap');
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${url}/?live-snaps`, { waitUntil: 'load', timeout: 120000 });

// every snapshot on the page, once they have all been rendered
await page.waitForFunction(
  () => {
    const imgs = [...document.querySelectorAll('img[data-snap-key]')];
    return imgs.length > 0 && imgs.every((i) => i.src.startsWith('data:image/png'));
  },
  { timeout: 180000, polling: 1000 },
);
const shots = await page.evaluate(async () => {
  const seen = {};
  for (const img of document.querySelectorAll('img[data-snap-key]')) {
    const key = img.dataset.snapKey;
    if (seen[key]) continue;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    seen[key] = c.toDataURL('image/webp', 0.9);
  }
  return seen;
});
await browser.close();

for (const [key, dataUrl] of Object.entries(shots)) {
  const file = path.join(out, `${key}.webp`);
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(file, buf);
  console.log(`${path.relative(process.cwd(), file)}  ${(buf.length / 1024).toFixed(0)} KB`);
}
