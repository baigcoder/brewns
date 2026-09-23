import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d';

async function testVisualComparison() {
  console.log('--- Starting Visual Comparison Audit for Iced Matcha ---');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const consoleErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
      }
    });

    await page.setViewport({ width: 1440, height: 900 });

    // 1. Navigate to base and wait for intro reveal
    console.log('Loading http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 4500));

    // 2. Open Iced Matcha PDP
    console.log('Opening Iced Matcha PDP...');
    await page.evaluate(() => {
      location.hash = '#shop/iced-matcha';
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture PHOTO view
    const photoPath = path.join(ARTIFACTS_DIR, 'matcha_photo_view.png');
    await page.screenshot({ path: photoPath, fullPage: false });
    console.log('Saved PHOTO View:', photoPath);

    // 3. Switch to 3D VIEW
    console.log('Switching to 3D VIEW...');
    const view3dBtn = await page.$('[data-view="3d"]');
    if (view3dBtn) {
      await view3dBtn.click();
      await new Promise((r) => setTimeout(r, 2200));
    }

    // Capture 3D view
    const view3dPath = path.join(ARTIFACTS_DIR, 'matcha_3d_view_upgraded.png');
    await page.screenshot({ path: view3dPath, fullPage: false });
    console.log('Saved UPGRADED 3D View:', view3dPath);

    // 4. Rotate 3D Cup slightly to verify 3D depth and typography
    console.log('Rotating 3D cup on turntable...');
    const canvas = await page.$('.pdp-canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 12 });
        await page.mouse.up();
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    const rotatedPath = path.join(ARTIFACTS_DIR, 'matcha_3d_view_rotated.png');
    await page.screenshot({ path: rotatedPath, fullPage: false });
    console.log('Saved Rotated 3D View:', rotatedPath);

    // 5. Also verify Cinnamon Roll on light background in 3D
    console.log('Opening Cinnamon Roll PDP in 3D...');
    await page.evaluate(() => {
      location.hash = '#shop/cinnamon-roll';
    });
    await new Promise((r) => setTimeout(r, 1500));

    const cinnamon3dBtn = await page.$('[data-view="3d"]');
    if (cinnamon3dBtn) {
      await cinnamon3dBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }

    const cinnamonPath = path.join(ARTIFACTS_DIR, 'cinnamon_roll_3d_light_bg.png');
    await page.screenshot({ path: cinnamonPath, fullPage: false });
    console.log('Saved Cinnamon Roll 3D on Light BG:', cinnamonPath);

    console.log('\n--- Visual Comparison Results ---');
    console.log('Console Errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log(consoleErrors);
    } else {
      console.log('ZERO console errors detected throughout visual comparison!');
    }
  } finally {
    await browser.close();
  }
}

testVisualComparison().catch((err) => {
  console.error('Visual test failed:', err);
  process.exit(1);
});
