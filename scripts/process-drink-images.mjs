import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const tool = createRequire(path.join(process.cwd(), 'tools/kitchen-white/package.json'));
const imgly = tool.resolve('@imgly/background-removal-node');
const sharp = createRequire(imgly)('sharp');
const { removeBackground } = tool('@imgly/background-removal-node');

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public/assets/kitchen');
const ORIGINALS = path.join(ROOT, 'assets-src/kitchen');
const BACKUP = path.join(ORIGINALS, 'backup-old');
const UPLOAD_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\abfe36ae-2ab3-4d9a-a233-87dcf03faf04\\.user_uploaded';

mkdirSync(ORIGINALS, { recursive: true });
mkdirSync(BACKUP, { recursive: true });

const distDir = path.join(process.cwd(), 'tools/kitchen-white/node_modules/@imgly/background-removal-node/dist/');
const publicPath = pathToFileURL(distDir).href + (distDir.endsWith('/') ? '' : '/');

const DRINKS = [
  { id: 'lime-soda', sourceFile: 'media_1790453541138.png' },
  { id: 'peach-iced-tea', sourceFile: 'media_1790453416366.png' },
  { id: 'mango-smoothie', sourceFile: 'media_1790453630789.png' },
  { id: 'mint-margarita', sourceFile: 'media_1790453165505.png' },
];

const SIZE = 1000;
const FILL = 0.82;
const HAZE = 35;
const MIN_PART = 0.05;

async function processDrink({ id, sourceFile }) {
  console.log(`\n========================================`);
  console.log(`Processing ${id} from ${sourceFile}...`);
  const srcPath = path.join(UPLOAD_DIR, sourceFile);

  // Backup existing webp if present
  const existingWebp = path.join(PUBLIC, `${id}.webp`);
  if (existsSync(existingWebp)) {
    copyFileSync(existingWebp, path.join(BACKUP, `${id}.webp`));
    console.log(`  Backed up existing image to: assets-src/kitchen/backup-old/${id}.webp`);
  }

  // Save new original
  const origPath = path.join(ORIGINALS, `${id}.png`);
  copyFileSync(srcPath, origPath);

  // Background removal
  console.log(`  Removing background with AI model...`);
  const input = await sharp(readFileSync(origPath)).rotate().png().toBuffer();
  const blob = new Blob([input], { type: 'image/png' });
  const cutBuffer = Buffer.from(await (await removeBackground(blob, { publicPath, model: 'medium', output: { format: 'image/png' } })).arrayBuffer());

  // Clean haze
  const { data, info } = await sharp(cutBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] < HAZE) data[i * 4 + 3] = 0;
  }

  // Connected components to find main drink and touching garnishes
  const part = new Int32Array(N).fill(-1);
  const parts = [];
  const stack = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    if (part[i] !== -1 || !data[i * 4 + 3]) continue;
    const partId = parts.length;
    const box = { area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    let top = 0;
    stack[top++] = i;
    part[i] = partId;
    while (top) {
      const j = stack[--top], x = j % W, y = (j - x) / W;
      box.area++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (part[k] === -1 && data[k * 4 + 3]) {
            part[k] = partId;
            stack[top++] = k;
          }
        }
      }
    }
    parts.push(box);
  }

  if (!parts.length) {
    console.warn(`  Warning: nothing found for ${id}`);
    return;
  }

  const main = parts.reduce((m, p) => (p.area > m.area ? p : m));
  const gap = Math.max(main.x1 - main.x0, main.y1 - main.y0) * 0.15;
  const keep = parts.map(
    (p) =>
      p === main ||
      (p.area >= main.area * MIN_PART &&
        p.x0 <= main.x1 + gap &&
        p.x1 >= main.x0 - gap &&
        p.y0 <= main.y1 + gap &&
        p.y1 >= main.y0 - gap),
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

  // Soft natural contact shadow underneath
  const sw = Math.round(w * 0.85);
  const sh = Math.max(14, Math.round(h * 0.1));
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><defs><filter id="b"><feGaussianBlur stdDeviation="${SIZE * 0.018}"/></filter></defs>` +
      `<ellipse cx="${SIZE / 2}" cy="${top + h - sh * 0.35}" rx="${sw / 2}" ry="${sh / 2}" fill="#3c2d23" fill-opacity=".32" filter="url(#b)"/></svg>`,
  );

  const destFile = path.join(PUBLIC, `${id}.webp`);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow }, { input: dish.data, left, top }])
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(destFile);

  console.log(`  ✓ Successfully written: public/assets/kitchen/${id}.webp`);
}

async function main() {
  for (const d of DRINKS) {
    await processDrink(d);
  }
  console.log('\n========================================');
  console.log('✓ All 4 drink images processed and replaced in menu!');
  console.log('========================================\n');
}

main().catch(console.error);
