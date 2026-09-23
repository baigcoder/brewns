import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://brewns-coffee.vercel.app/assets/';
const DEST_DIR = path.resolve(process.cwd(), 'public/assets');

const ASSETS = [
  'fonts/SpaceMono-Regular.ttf',
  'fonts/Allura-Regular.ttf',
  'shared/wordmark-mask.webp',
  'shared/swirl-mask.webp',
  'hero/models.glb',
  'menu/menu-receipt.webp',
  'menu/menu-espresso.webp',
  'menu/menu-latte.webp',
  'menu/menu-iced-coffee.webp',
  'menu/menu-cinnamon.webp',
  'locations/clock.webp',
  'locations/cup.webp',
  'order/bg-table.webp',
  'order/printer.webp',
  'order/matcha-cup.webp',
];

async function download() {
  for (const asset of ASSETS) {
    const url = BASE_URL + asset;
    const dest = path.join(DEST_DIR, asset);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log(`Downloading ${url}...`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed ${url}: ${res.status}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      console.log(`Saved to ${dest} (${buffer.length} bytes)`);
    } catch (err) {
      console.error(`Error downloading ${url}:`, err);
    }
  }
}

download();
