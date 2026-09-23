import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d';

async function testPDP3DVariety() {
  console.log('--- Starting PDP 3D Variety Rendering Verification ---');

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
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

    // 1. Initial load and wait for intro reveal
    console.log('Loading http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 4500));

    // Open cinnamon-roll PDP via hash routing
    console.log('Opening cinnamon-roll PDP...');
    await page.evaluate(() => {
      location.hash = '#shop/cinnamon-roll';
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture photo state
    const photoPath = path.join(ARTIFACTS_DIR, 'pdp_photo_cinnamon_roll.png');
    await page.screenshot({ path: photoPath, fullPage: false });
    console.log('Captured Photo PDP:', photoPath);

    // 2. Switch to 3D VIEW
    console.log('Switching to 3D VIEW...');
    const view3dBtn = await page.$('[data-view="3d"]');
    if (view3dBtn) {
      await view3dBtn.click();
      await new Promise((r) => setTimeout(r, 2200));
    }

    const default3DPath = path.join(ARTIFACTS_DIR, 'pdp_3d_cinnamon_roll_default.png');
    await page.screenshot({ path: default3DPath, fullPage: false });
    console.log('Captured Default 3D View:', default3DPath);


    // 3. Select SERVE: WARMED
    console.log('Selecting SERVE: WARMED in 3D view...');
    await page.evaluate(() => {
      const warmChoice = document.querySelector('[data-opt="warm"] [data-choice="1"]') as HTMLButtonElement;
      warmChoice?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const warmed3DPath = path.join(ARTIFACTS_DIR, 'pdp_3d_cinnamon_roll_warmed.png');
    await page.screenshot({ path: warmed3DPath, fullPage: false });
    console.log('Captured Warmed 3D View (with Steam):', warmed3DPath);

    // 4. Select GLAZE: EXTRA
    console.log('Selecting GLAZE: EXTRA in 3D view...');
    await page.evaluate(() => {
      const extraGlazeChoice = document.querySelector('[data-opt="glaze"] [data-choice="1"]') as HTMLButtonElement;
      extraGlazeChoice?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const extraGlaze3DPath = path.join(ARTIFACTS_DIR, 'pdp_3d_cinnamon_roll_warmed_extra_glaze.png');
    await page.screenshot({ path: extraGlaze3DPath, fullPage: false });
    console.log('Captured Warmed + Extra Glaze 3D View:', extraGlaze3DPath);

    // 5. Test 3D Turntable Drag
    console.log('Dragging 3D canvas to rotate...');
    const canvas = await page.$('.pdp-canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 15 });
        await page.mouse.up();
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    const rotated3DPath = path.join(ARTIFACTS_DIR, 'pdp_3d_cinnamon_roll_rotated.png');
    await page.screenshot({ path: rotated3DPath, fullPage: false });
    console.log('Captured Rotated 3D View:', rotated3DPath);

    // 6. Test Iced Matcha 3D Model
    console.log('Opening http://localhost:3000/#shop/iced-matcha...');
    await page.goto('http://localhost:3000/#shop/iced-matcha', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    const matcha3DBtn = await page.$('[data-view="3d"]');
    if (matcha3DBtn) {
      await matcha3DBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }

    const matcha3DPath = path.join(ARTIFACTS_DIR, 'pdp_3d_iced_matcha.png');
    await page.screenshot({ path: matcha3DPath, fullPage: false });
    console.log('Captured Iced Matcha 3D Glass View:', matcha3DPath);

    console.log('\n--- PDP 3D Verification Results ---');
    console.log('Console Errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log(consoleErrors);
    } else {
      console.log('ZERO console errors detected throughout PDP 3D interactions!');
    }
  } finally {
    await browser.close();
  }
}

testPDP3DVariety().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
