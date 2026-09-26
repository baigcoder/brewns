import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const targets = [
  path.join(root, 'public', 'assets', 'locations', 'inside'),
  path.join('C:', 'Users', 'Baigo', 'Downloads', 'brewns-latest', 'public', 'assets', 'locations', 'inside'),
  path.join('C:', 'Users', 'Baigo', 'Downloads', 'brewns-latest', 'assets-src', 'locations', 'inside'),
];

for (const t of targets) {
  fs.mkdirSync(t, { recursive: true });
}

export async function processImage(sourcePath, key, targetRatio = null) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    return;
  }

  console.log(`Processing ${key} from ${sourcePath}...`);
  const img = sharp(sourcePath);
  const meta = await img.metadata();
  console.log(`Original ${key}: ${meta.width}x${meta.height}`);

  // Calculate dimensions based on original key aspect
  const dims = {
    storefront: { w: 1400, h: 817, w2: 2400, h2: 1400 },
    counter: { w: 1400, h: 817, w2: 2400, h2: 1400 },
    table: { w: 1400, h: 659, w2: 2400, h2: 1130 },
    sofas: { w: 1400, h: 689, w2: 2400, h2: 1181 },
    shelf: { w: 1400, h: 1007, w2: 2400, h2: 1727 },
  }[key] || { w: 1400, h: 800, w2: 2400, h2: 1370 };

  for (const dir of targets) {
    // Standard version
    const stdPath = path.join(dir, `${key}.webp`);
    await sharp(sourcePath)
      .resize(dims.w, dims.h, { fit: 'cover', position: 'center' })
      .webp({ quality: 92, effort: 6 })
      .toFile(stdPath);

    // 2x Retina version (only in public directories)
    if (dir.includes('public')) {
      const retPath = path.join(dir, `${key}@2x.webp`);
      await sharp(sourcePath)
        .resize(dims.w2, dims.h2, { fit: 'cover', position: 'center' })
        .webp({ quality: 90, effort: 6 })
        .toFile(retPath);
    }
  }

  console.log(`Successfully generated ${key}.webp and ${key}@2x.webp in all targets.`);
}

// CLI runner if invoked directly with arguments: node process-location-images.mjs <source> <key>
if (process.argv[2] && process.argv[3]) {
  processImage(process.argv[2], process.argv[3]);
}
