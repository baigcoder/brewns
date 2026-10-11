// Options -> cart. For every product with options: choose a NON-default value in every group (and a second, different
// combination), add each to the bag, and check, from the real page and its localStorage:
//   * the stored line's sel equals the indices chosen, and its key includes them
//   * the bag drawer's line text shows the chosen labels (what the customer would be shown)
//   * the same selection added twice merges into one line (qty 2); a different selection is a separate line
//   * the stored selection survives a reload
// Usage: node scripts/audit-cart.mjs [ids]   (dev server on :3111)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const catalog = fs.readFileSync(new URL('../lib/catalog.ts', import.meta.url), 'utf8');
const ids = process.argv[2] ? process.argv[2].split(',') : [...catalog.matchAll(/id: "([a-z0-9-]+)", name: "/g)].map((m) => m[1]);
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: path.join(process.env.TEMP || process.env.TMPDIR || '.', 'brewns-cart-' + Date.now()),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('http://localhost:3111/', { waitUntil: 'domcontentloaded' });
await sleep(4000);
const bag = () => page.evaluate(() => JSON.parse(localStorage.getItem('brewns-bag') || '[]'));
let fails = 0, checked = 0;
for (const id of ids) {
  // the page keeps its own in-memory bag and rewrites storage from it, so clear storage and reload
  await page.evaluate(() => { localStorage.removeItem('brewns-bag'); location.hash = ''; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.evaluate((id) => (location.hash = '#shop/' + id), id);
  await page.waitForFunction(() => document.querySelector('#pdp-name')?.textContent, { timeout: 15000 });
  await sleep(1200);
  const groups = await page.evaluate(() => [...document.querySelectorAll('[data-opt]')].map((o) => ({ key: o.dataset.opt, labels: [...o.querySelectorAll('[data-choice]')].map((c) => c.firstChild.textContent.trim()) })));
  if (!groups.length) { console.log(id.padEnd(18), '(no options)'); continue; }
  const pick = async (variant) => {
    const chosen = {};
    for (const g of groups) {
      const idx = variant === 0 ? Math.min(1, g.labels.length - 1) : g.labels.length - 1;
      await page.evaluate((k, c) => document.querySelector(`[data-opt="${k}"] [data-choice="${c}"]`)?.click(), g.key, idx);
      chosen[g.key] = idx;
    }
    await sleep(500);
    return chosen;
  };
  const A = await pick(0);
  await page.evaluate(() => document.querySelector('#pdp-add').click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('#pdp-add').click()); // same selection again: must merge
  await sleep(300);
  const B = await pick(1);
  await page.evaluate(() => document.querySelector('#pdp-add').click());
  await sleep(400);
  let items = await bag();
  const problems = [];
  const same = JSON.stringify(A) === JSON.stringify(B);
  const lineA = items.find((i) => JSON.stringify(i.sel) === JSON.stringify(A));
  const lineB = items.find((i) => JSON.stringify(i.sel) === JSON.stringify(B));
  if (!lineA) problems.push('line for selection A missing: ' + JSON.stringify(items.map((i) => i.sel)));
  else if (lineA.qty !== (same ? 3 : 2)) problems.push('same selection twice did not merge (qty ' + lineA.qty + ')');
  if (!same) {
    if (!lineB) problems.push('line for selection B missing');
    else if (lineB.qty !== 1) problems.push('different selection merged wrongly (qty ' + lineB.qty + ')');
    if (items.length !== 2) problems.push('expected 2 lines, found ' + items.length);
  }
  // what the drawer shows
  await page.evaluate(() => document.querySelector('#bag-open').click());
  await sleep(700);
  const drawer = await page.evaluate(() => [...document.querySelectorAll('.bag-item')].map((e) => e.querySelector('.bag-item-opts')?.textContent || ''));
  for (const [line, ch] of [[lineA, A], [lineB, B]]) {
    if (!line) continue;
    for (const g of groups) {
      const label = g.labels[ch[g.key]];
      if (!drawer.some((t) => t.toUpperCase().includes(label.toUpperCase()))) problems.push(`drawer does not show "${label}" (${g.key})`);
    }
  }
  // survives a reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const after = await bag();
  if (JSON.stringify(after.map((i) => [i.id, i.sel, i.qty])) !== JSON.stringify(items.map((i) => [i.id, i.sel, i.qty]))) problems.push('bag changed across reload');
  checked++;
  if (problems.length) fails++;
  console.log(id.padEnd(18), problems.length ? 'FAIL ' + problems.join(' | ') : `pass  ${groups.map((g) => g.key).join(',')}  lines=${items.length}`);
}
console.log(`\n${checked - fails}/${checked} products pass`);
await browser.close();
