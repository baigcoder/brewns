/**
 * Puts the kitchen photos on a clean white background, like the coffee shots:
 * the dish is cut out of its photo, centred on a white square and given a soft
 * shadow. Runs on your own computer, no upload:
 *
 *   bun run kitchen:white          new photos in public/assets/kitchen/
 *   bun run kitchen:white --all    redo every photo from its original
 *
 * It runs under Node.js (bun run starts it with node): on Windows, Bun cannot
 * load the image libraries it needs.
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
// Use the very sharp the cut-out library uses. Loading a second, newer sharp
// next to it breaks on Windows: both ship a libvips-42.dll, Windows reuses
// whichever loaded first, and the other fails with "procedure not found".
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('@imgly/background-removal-node'))('sharp');
const { removeBackground } = await import('@imgly/background-removal-node');

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public/assets/kitchen');
const ORIGINALS = path.join(ROOT, 'assets-src/kitchen');
const SIZE = 1000; // output square, px
const FILL = 0.8; // how much of the square the dish fills
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

  // crop to the dish (ignoring faint haze), then size it to the square
  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) {
    console.log('nothing found to cut out, skipped');
    continue;
  }
  const dish = await sharp(cut)
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

  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' } })
    .composite([{ input: shadow }, { input: dish.data, left, top }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(PUBLIC, `${id}.jpg.tmp`));
  // the served photo becomes <id>.jpg; a .png/.webp original leaves public/
  for (const f of readdirSync(PUBLIC)) if (path.parse(f).name === id && !f.endsWith('.tmp')) unlinkSync(path.join(PUBLIC, f));
  copyFileSync(path.join(PUBLIC, `${id}.jpg.tmp`), path.join(PUBLIC, `${id}.jpg`));
  unlinkSync(path.join(PUBLIC, `${id}.jpg.tmp`));
  console.log(`public/assets/kitchen/${id}.jpg`);
}
console.log('\nDone. Reload the site to see them.');
