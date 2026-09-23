import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d';

async function testNextLevelFeatures() {
  console.log('--- Starting Next-Level Visual & Interactive Verification ---');

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
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait for intro transition to settle and reveal hero (3.5s)
    await new Promise((r) => setTimeout(r, 4000));

    // 1. Verify and toggle Sound
    console.log('Testing sound toggle...');
    const soundToggle = await page.$('#sound-toggle');
    if (soundToggle) {
      await soundToggle.click();
      await new Promise((r) => setTimeout(r, 400));
      console.log('Sound toggled active!');
    } else {
      console.warn('Sound toggle not found!');
    }

    // Capture Hero with 3D models and sound active
    const heroPath = path.join(ARTIFACTS_DIR, 'next_level_hero_sound.png');
    await page.screenshot({ path: heroPath, fullPage: false });
    console.log('Captured Hero & Sound:', heroPath);

    // 2. Test Shop Section and Taste Calibrator
    console.log('Testing Shop Section and Taste Calibrator...');
    await page.evaluate(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 1000));

    const shopPath = path.join(ARTIFACTS_DIR, 'shop_with_calibrator_btn.png');
    await page.screenshot({ path: shopPath, fullPage: false });
    console.log('Captured Shop with Quiz Button:', shopPath);

    const calibratorBtn = await page.$('#open-calibrator');
    if (calibratorBtn) {
      await calibratorBtn.click();
      await new Promise((r) => setTimeout(r, 600));

      // Click method option: espresso
      console.log('Quiz step 1: selecting method...');
      await page.waitForSelector('[data-cal-opt="espresso"]');
      await page.click('[data-cal-opt="espresso"]');
      await new Promise((r) => setTimeout(r, 600));

      // Click profile option: cacao
      console.log('Quiz step 2: selecting profile...');
      await page.waitForSelector('[data-cal-opt="cacao"]');
      await page.click('[data-cal-opt="cacao"]');
      await new Promise((r) => setTimeout(r, 600));

      // Click cadence option: morning
      console.log('Quiz step 3: selecting cadence...');
      await page.waitForSelector('[data-cal-opt="morning"]');
      await page.click('[data-cal-opt="morning"]');
      await new Promise((r) => setTimeout(r, 1000));

      const calibratorResultPath = path.join(ARTIFACTS_DIR, 'taste_calibrator_recommendation.png');
      await page.screenshot({ path: calibratorResultPath, fullPage: false });
      console.log('Captured Taste Calibrator recommendation:', calibratorResultPath);

      // Click "+ ADD TO BAG" in Calibrator
      const addBlendBtn = await page.$('[data-cal-add]');
      if (addBlendBtn) {
        await addBlendBtn.click();
        await new Promise((r) => setTimeout(r, 800));
        console.log('Added recommended blend to bag!');
      }


      // Close calibrator modal
      const closeBtn = await page.$('.calibrator-close');
      if (closeBtn) {
        await closeBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 3. Test Locations with Live Wait Status Badges
    console.log('Testing Locations section...');
    await page.evaluate(() => document.getElementById('locations')?.scrollIntoView({ behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 1000));

    const locationsPath = path.join(ARTIFACTS_DIR, 'locations_live_wait_badges.png');
    await page.screenshot({ path: locationsPath, fullPage: false });
    console.log('Captured Locations with Live Badges:', locationsPath);

    // 4. Test Cart Drawer with Added Product
    console.log('Opening Cart Drawer...');
    const bagOpen = await page.$('#bag-open');
    if (bagOpen) {
      await bagOpen.click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const cartDrawerPath = path.join(ARTIFACTS_DIR, 'cart_drawer_with_item.png');
    await page.screenshot({ path: cartDrawerPath, fullPage: false });
    console.log('Captured Cart Drawer with Item:', cartDrawerPath);


    console.log('\n--- Test Results ---');
    console.log('Console Errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log(consoleErrors);
    } else {
      console.log('ZERO console errors detected across all interactions!');
    }
  } finally {
    await browser.close();
  }
}

testNextLevelFeatures().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
