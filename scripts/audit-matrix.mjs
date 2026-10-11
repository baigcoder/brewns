// Every product at every width: does the right page open, is the right viewer offered, does the piece fit?
// For each product and width it checks, without a human looking at pictures:
//   identity   #pdp-name equals the catalogue name
//   policy     tab labels match components/brewns/viewPolicy.ts (3D VIEW / TILT VIEW / none) and the hint text is honest
//   overflow   the page is no wider than the viewport
//   framing    the product's pixels (found by colour distance from the stage corner) stay inside the stage, are centred,
//              and do not touch the hint or the Photo / 3D buttons
//   volume     (3D models) after turning 90 and 180 degrees the silhouette is still a solid object, not a sliver
//   relief     (TILT VIEW) after a very long drag the silhouette is still the same product, not turned away
// It does not judge likeness to the photograph: that is scripts/audit-3d.mjs and a person.
// Usage: node scripts/audit-matrix.mjs <outDir> [widths=320,375,390,768,1024,1440,1920] [ids]   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const [out, widthArg, idArg] = process.argv.slice(2);
if (!out) throw new Error('usage: node scripts/audit-matrix.mjs <outDir> [widths] [ids]');
const widths = (widthArg || '320,375,390,768,1024,1440,1920').split(',').map(Number);
const BASE = process.env.BASE || 'http://localhost:3111';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });

const catalog = fs.readFileSync(new URL('../lib/catalog.ts', import.meta.url), 'utf8');
const names = new Map([...catalog.matchAll(/id: "([a-z0-9-]+)", name: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const ids = idArg ? idArg.split(',') : [...names.keys()];
const policySrc = fs.readFileSync(new URL('../components/brewns/viewPolicy.ts', import.meta.url), 'utf8');
const setOf = (name) => new Set([...(policySrc.match(new RegExp(`const ${name} = new Set<string>\\(\\[([^\\]]*)\\]`))?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]));
const MODEL = setOf('MODEL'), PHOTO = setOf('PHOTO');
const expected = (id) => (id === 'gift-card' ? 'card' : PHOTO.has(id) ? 'photo' : MODEL.has(id) ? 'model' : 'relief');

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-matrix-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

// Bounding box of everything that differs from the stage corner, measured in the page from a PNG of the stage.
const measure = (page, png) =>
  page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data;
    const at = (px, py) => [d[(py * img.width + px) * 4], d[(py * img.width + px) * 4 + 1], d[(py * img.width + px) * 4 + 2]];
    const bg = at(4, 4);
    // the stage's own faint swirl differs from the corner by well under this; a product, even its shadow, by more
    const T = 70;
    const col = new Array(img.width).fill(0), row = new Array(img.height).fill(0);
    let n = 0;
    const B = 3; // the stage's own outer pixels belong to the page, not the product
    for (let py = B; py < img.height - B; py++) for (let px = B; px < img.width - B; px++) {
      const p = at(px, py);
      const spread = Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
      const lum = (p[0] + p[1] + p[2]) / 3;
      // the cast shadow is a neutral mid-grey on the floor; the products are darker, lighter or coloured
      if (spread < 14 && lum > 110 && lum < 226) continue;
      if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > T) { n++; col[px]++; row[py]++; }
    }
    // a long cast shadow is a thin, faint band: only columns and rows well filled compared with the fullest count as the piece
    const solid = (a) => { const m = Math.max(...a) * 0.25; let lo = -1, hi = -1; a.forEach((v, i) => { if (v > m) { if (lo < 0) lo = i; hi = i; } }); return [lo, hi]; };
    const [x0, x1] = solid(col), [y0, y1] = solid(row);
    return { w: img.width, h: img.height, x0, y0, x1, y1, n };
  }, png.toString('base64'));

for (const width of widths) {
  const touch = width < 700;
  const page = await browser.newPage();
  await page.setViewport({ width, height: touch ? 800 : width >= 1900 ? 1080 : 900, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (process.env.INIT_JS) await page.evaluateOnNewDocument(process.env.INIT_JS); // experiments, e.g. 'window.__noLoose = true'
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // Shot of the stage with the page's own furniture and the background swirl hidden, so only the product is left.
  const stageShot = async () => {
    const tag = await page.addStyleTag({ content: '.pdp-views,#pdp-hint,.pdp-crumb,.pdp-close,.x-btn,.pdp-swirl{visibility:hidden!important}' });
    const png = await (await page.$('.pdp-stage')).screenshot();
    await page.evaluate((el) => el.remove(), tag);
    return png;
  };
  const drag = async (dx) => {
    const b = await (await page.$('.pdp-stage canvas')).boundingBox();
    const x = b.x + b.width / 2 - dx / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y, { steps: 10 }); await page.mouse.up();
    await sleep(500);
  };

  for (const id of ids) {
    const r = { id, width, expect: expected(id), checks: {}, fail: [] };
    try {
      await page.evaluate(() => { location.hash = ''; });
      await sleep(250);
      await page.evaluate((id) => { location.hash = '#shop/' + id; }, id);
      let name = null;
      for (let i = 0; i < 40 && name !== names.get(id); i++) { await sleep(200); name = await page.evaluate(() => document.querySelector('#pdp-name')?.textContent?.trim()); }
      r.checks.identity = name === names.get(id);
      if (!r.checks.identity) { r.fail.push(`opened "${name}" not "${names.get(id)}"`); throw new Error('open'); }
      await sleep(1500);
      r.labels = await page.evaluate(() => [...document.querySelectorAll('.pdp-view')].map((b) => b.textContent.trim()));
      r.variant = await page.evaluate(() => [...document.querySelectorAll('[data-opt] [aria-checked="true"]')].map((c) => c.firstChild.textContent.trim()));
      const want = { model: ['PHOTO', '3D VIEW'], relief: ['PHOTO', 'TILT VIEW'], photo: [], card: null }[r.expect];
      r.checks.policy = want === null || JSON.stringify(r.labels) === JSON.stringify(want);
      if (!r.checks.policy) r.fail.push(`labels ${JSON.stringify(r.labels)} expected ${JSON.stringify(want)}`);
      r.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      r.checks.noOverflow = r.overflowX <= 0;
      if (!r.checks.noOverflow) r.fail.push(`page ${r.overflowX}px wider than the viewport`);
      r.checks.photoLoaded = await page.evaluate(() => { const i = document.querySelector('.pdp-stage img.pdp-photo'); return !i || (i.complete && i.naturalWidth > 0); });
      if (!r.checks.photoLoaded) r.fail.push('photo did not load');

      if (r.expect === 'model' || r.expect === 'relief') {
        await page.evaluate(() => document.querySelector('[data-view="3d"]').click());
        await page.waitForFunction(() => document.querySelector('.pdp-stage canvas') && !document.querySelector('.pdp-stage .pcard-loading'), { timeout: 20000 }).catch(() => {});
        await sleep(2200);
        r.checks.canvas = await page.evaluate(() => document.querySelectorAll('.pdp-stage canvas').length === 1);
        r.hint = await page.evaluate(() => document.querySelector('#pdp-hint')?.textContent);
        r.checks.hintHonest = r.expect === 'model' ? /ROTATE/.test(r.hint) && !/RELIEF|TILT/.test(r.hint) : /RELIEF/.test(r.hint) && /TILT/.test(r.hint) && !/ROTATE/.test(r.hint);
        if (!r.checks.hintHonest) r.fail.push(`hint "${r.hint}"`);
        const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, sel);
        const stage = await rect('.pdp-stage');
        const ctl = [await rect('.pdp-views'), await rect('#pdp-hint')].filter(Boolean);
        const m0 = await measure(page, await stageShot());
        r.front = m0;
        const edge = 0.01;
        const inside = m0.n > 200 && m0.x0 > m0.w * edge && m0.x1 < m0.w * (1 - edge) && m0.y0 > m0.h * edge && m0.y1 < m0.h * (1 - edge);
        const cx = (m0.x0 + m0.x1) / 2 / m0.w;
        const centred = Math.abs(cx - 0.5) < 0.12;
        // product box in page coordinates against the hint and buttons
        const box = { x: stage.x + m0.x0, y: stage.y + m0.y0, w: m0.x1 - m0.x0, h: m0.y1 - m0.y0 };
        const hits = ctl.filter((c) => box.x < c.x + c.w && box.x + box.w > c.x && box.y < c.y + c.h && box.y + box.h > c.y);
        r.checks.framing = inside; r.checks.centred = centred; r.checks.clearOfControls = hits.length === 0;
        if (!inside) r.fail.push(`silhouette not inside the stage (${JSON.stringify(m0)})`);
        if (!centred) r.fail.push(`off centre (${cx.toFixed(2)})`);
        if (hits.length) r.fail.push('silhouette overlaps controls');
        const fw = m0.x1 - m0.x0;
        if (r.expect === 'model') {
          await drag(157); const m90 = await measure(page, await stageShot());
          await drag(157); const m180 = await measure(page, await stageShot());
          r.turn = { w90: (m90.x1 - m90.x0) / fw, w180: (m180.x1 - m180.x0) / fw, n90: m90.n / m0.n, n180: m180.n / m0.n };
          // a flat picture turned side-on collapses to a sliver; a solid object keeps substantial area from every side
          // Width is what tells a solid piece from a flat card: a card turned side-on collapses to a sliver (width ratio near
          // 0), a solid object keeps its width. Area is only a floor, because a pale glass of drink has almost no colour
          // of its own and its area score mostly measures the garnish on it (which turns edge-on): lime soda scored 0.44
          // with its loose garnish removed, with the glass the same width from every side.
          r.turn.wMin = Math.min(r.turn.w90, r.turn.w180);
          r.checks.solidFromEverySide = r.turn.w90 > 0.5 && r.turn.w180 > 0.5 && r.turn.n90 > 0.25 && r.turn.n180 > 0.25 && m90.x0 > 0 && m180.x1 < m180.w;
          if (!r.checks.solidFromEverySide) r.fail.push(`silhouette area after turning ${JSON.stringify(r.turn)}`);
        } else {
          await drag(900); const mm = await measure(page, await stageShot());
          r.turn = { w: (mm.x1 - mm.x0) / fw, n: mm.n / m0.n };
          r.checks.tiltStaysLimited = r.turn.n > 0.7 && r.turn.n < 1.4;
          if (!r.checks.tiltStaysLimited) r.fail.push(`after a long drag the silhouette changed to ${JSON.stringify(r.turn)}`);
        }
      }
    } catch (e) { if (!r.fail.length) r.fail.push(String(e).slice(0, 160)); }
    r.errors = errors.splice(0).slice(0, 3);
    r.pass = r.fail.length === 0;
    fs.appendFileSync(path.join(out, 'matrix.jsonl'), JSON.stringify(r) + '\n');
    console.log(String(width).padEnd(5), id.padEnd(18), r.pass ? 'pass' : 'FAIL ' + r.fail.join(' | '));
  }
  await page.close();
}
await browser.close();
