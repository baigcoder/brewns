/**
 * Cuts the kitchen photos out, like the coffee shots: the dish is lifted out of
 * its photo, centred on a transparent square and given a soft contact shadow,
 * so it stands straight on whatever card shows it (no white box).
 * Runs on your own computer, no upload:
 *
 *   bun run kitchen:white          new photos in public/assets/kitchen/
 *   bun run kitchen:white --all    redo every photo from its original
 *
 * It runs under Node.js (bun run starts it with node): on Windows, Bun cannot
 * load the image libraries it needs. The first run installs the cut-out model
 * into tools/kitchen-white/ (about 300 MB, once).
 *
 * The untouched originals are kept in assets-src/kitchen/ (not served), so a
 * photo can always be redone. The first run downloads nothing: the cut-out
 * model ships inside @imgly/background-removal-node.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

if (process.versions.bun && process.platform === 'win32') {
  console.error(
    [
      'This step needs Node.js on Windows (Bun cannot load the image libraries there).',
      '',
      '  1. Install Node.js:   winget install OpenJS.NodeJS.LTS',
      '     (or download the LTS installer from https://nodejs.org)',
      '  2. Close and reopen PowerShell',
      '  3. Run again:         bun run kitchen:white',
    ].join('\n'),
  );
  process.exit(1);
}
// The cut-out library lives in tools/kitchen-white/ (its own install, so the
// site's doesn't carry ~300 MB). Use the very sharp it uses: loading a second,
// newer sharp next to it breaks on Windows, where both ship a libvips-42.dll,
// Windows reuses whichever loaded first and the other fails with "procedure
// not found".
const tool = createRequire(path.join(process.cwd(), 'tools/kitchen-white/package.json'));
const imgly = tool.resolve('@imgly/background-removal-node');
const sharp = createRequire(imgly)('sharp');
const { removeBackground } = tool('@imgly/background-removal-node');

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public/assets/kitchen');
const ORIGINALS = path.join(ROOT, 'assets-src/kitchen');
const SIZE = 1000; // output square, px
const FILL = 0.8; // how much of the square the dish fills
const HAZE = 40; // alpha below this is haze, not dish (0–255)
const MIN_PART = 0.08; // a separate bit smaller than this share of the dish is dropped
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const redoAll = process.argv.includes('--all');
mkdirSync(ORIGINALS, { recursive: true });

// new photos: anything in public/ that has no original kept yet; --all: every original
const photos = readdirSync(PUBLIC).filter((f) => MIME[path.extname(f).toLowerCase()]);
const todo = redoAll
  ? readdirSync(ORIGINALS).filter((f) => MIME[path.extname(f).toLowerCase()])
  : photos.filter((f) => !readdirSync(ORIGINALS).some((o) => path.parse(o).name === path.parse(f).name));
if (!todo.length) {
  console.log(redoAll ? 'No originals in assets-src/kitchen/.' : 'No new photos in public/assets/kitchen/ (use --all to redo them).');
  process.exit(0);
}

for (const name of todo) {
  const id = path.parse(name).name;
  const original = path.join(ORIGINALS, name);
  if (!existsSync(original)) copyFileSync(path.join(PUBLIC, name), original);
  process.stdout.write(`${name} … `);

  // the dish alone, on transparency
  const input = await sharp(readFileSync(original)).rotate().png().toBuffer();
  const cut = Buffer.from(await (await removeBackground(new Blob([input], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } })).arrayBuffer());

  // clean the cut-out: drop faint haze, and drop separate bits well away from
  // the dish (a glass in the background, a stray chip) that are much smaller
  // than it, then crop to what is left
  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  for (let i = 0; i < N; i++) if (data[i * 4 + 3] < HAZE) data[i * 4 + 3] = 0;
  const part = new Int32Array(N).fill(-1);
  const parts = [];
  const stack = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (part[i] !== -1 || !data[i * 4 + 3]) continue;
    const id = parts.length;
    const box = { area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    let top = 0;
    stack[top++] = i;
    part[i] = id;
    while (top) {
      const j = stack[--top], x = j % W, y = (j - x) / W;
      box.area++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (part[k] === -1 && data[k * 4 + 3]) {
            part[k] = id;
            stack[top++] = k;
          }
        }
    }
    parts.push(box);
  }
  if (!parts.length) {
    console.log('nothing found to cut out, skipped');
    continue;
  }
  const main = parts.reduce((m, p) => (p.area > m.area ? p : m));
  const gap = Math.max(main.x1 - main.x0, main.y1 - main.y0) * 0.06;
  const keep = parts.map(
    (p) =>
      p === main ||
      (p.area >= main.area * MIN_PART &&
        // touching or tucked against the dish, like a garnish or a sauce pot beside it
        p.x0 <= main.x1 + gap && p.x1 >= main.x0 - gap && p.y0 <= main.y1 + gap && p.y1 >= main.y0 - gap),
  );
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) {
    if (!data[i * 4 + 3]) continue;
    if (!keep[part[i]]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const x = i % W, y = (i - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const cleaned = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const dish = await sharp(cleaned)
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: Math.round(SIZE * FILL), height: Math.round(SIZE * FILL), fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = dish.info;
  const left = Math.round((SIZE - w) / 2);
  const top = Math.round((SIZE - h) / 2 + SIZE * 0.02);

  // a soft contact shadow under the dish
  const sw = Math.round(w * 0.82), sh = Math.max(12, Math.round(h * 0.1));
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><defs><filter id="b"><feGaussianBlur stdDeviation="${SIZE * 0.018}"/></filter></defs>` +
      `<ellipse cx="${SIZE / 2}" cy="${top + h - sh * 0.35}" rx="${sw / 2}" ry="${sh / 2}" fill="#3c2d23" fill-opacity=".28" filter="url(#b)"/></svg>`,
  );

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow }, { input: dish.data, left, top }])
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(path.join(PUBLIC, `${id}.webp.tmp`));
  // the served photo becomes <id>.webp; a .jpg/.png original leaves public/
  for (const f of readdirSync(PUBLIC)) if (path.parse(f).name === id && !f.endsWith('.tmp')) unlinkSync(path.join(PUBLIC, f));
  copyFileSync(path.join(PUBLIC, `${id}.webp.tmp`), path.join(PUBLIC, `${id}.webp`));
  unlinkSync(path.join(PUBLIC, `${id}.webp.tmp`));
  console.log(`public/assets/kitchen/${id}.webp`);
}
console.log('\nDone. Reload the site to see them.');
