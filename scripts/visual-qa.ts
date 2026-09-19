import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\8b0ed356-f777-429f-94e1-2cd0b93732c7';

async function runVisualQA() {
  console.log('--- Starting Automated Visual Quality Gate Audit ---');

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
    // 1. Desktop 1440x900 Test
    console.log('[1/4] Capturing Desktop 1440x900...');
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`[HTTP Error] ${res.status()}: ${res.url()}`);
      }
    });

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait for intro transition to settle and reveal hero
    await new Promise((r) => setTimeout(r, 3400));

    const desktop1440Path = path.join(ARTIFACTS_DIR, 'desktop_1440x900.png');
    await page.screenshot({ path: desktop1440Path, fullPage: false });
    console.log('Saved:', desktop1440Path);

    // Section 2: Menu
    console.log('Capturing #menu section...');
    await page.evaluate(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 800));
    const menuPath = path.join(ARTIFACTS_DIR, 'section_menu.png');
    await page.screenshot({ path: menuPath, fullPage: false });
    console.log('Saved Menu Section:', menuPath);

    // Section 3: Shop
    console.log('Capturing #shop section...');
    await page.evaluate(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 800));
    const shopPath = path.join(ARTIFACTS_DIR, 'section_shop.png');
    await page.screenshot({ path: shopPath, fullPage: false });
    console.log('Saved Shop Section:', shopPath);

    // Section 4: Locations & Clock
    console.log('Capturing #locations section...');
    await page.evaluate(() => document.getElementById('locations')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1000));
    const locsPath = path.join(ARTIFACTS_DIR, 'section_locations.png');
    await page.screenshot({ path: locsPath, fullPage: false });
    console.log('Saved Locations Section:', locsPath);

    // Section 5: Philosophy & Bean Field
    console.log('Capturing #story section...');
    await page.evaluate(() => document.getElementById('story')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1000));
    const storyPath = path.join(ARTIFACTS_DIR, 'section_story.png');
    await page.screenshot({ path: storyPath, fullPage: false });
    console.log('Saved Story Section:', storyPath);

    // Section 6: Order & Thermal Printer
    console.log('Capturing #order section...');
    await page.evaluate(() => document.getElementById('order')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1200));
    const orderPath = path.join(ARTIFACTS_DIR, 'section_order.png');
    await page.screenshot({ path: orderPath, fullPage: false });
    console.log('Saved Order Section:', orderPath);

    // Test Adding to Bag
    console.log('Testing Add to Bag button on Menu...');
    await page.evaluate(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 500));
    const orderBtn = await page.$('article button');
    if (orderBtn) {
      await orderBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // 2. Desktop 1920x1080 Test
    console.log('[2/4] Capturing Desktop 1920x1080...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3400));

    const desktop1920Path = path.join(ARTIFACTS_DIR, 'desktop_1920x1080.png');
    await page.screenshot({ path: desktop1920Path, fullPage: false });
    console.log('Saved:', desktop1920Path);

    // 3. Tablet 768x1024 Test
    console.log('[3/4] Capturing Tablet 768x1024...');
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3400));

    const tabletPath = path.join(ARTIFACTS_DIR, 'tablet_768x1024.png');
    await page.screenshot({ path: tabletPath, fullPage: false });
    console.log('Saved:', tabletPath);

    // 4. Mobile 390x844 Test
    console.log('[4/4] Capturing Mobile 390x844...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 3400));

    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log('Mobile horizontal overflow detected:', hasHorizontalScroll);

    // Capture mobile landing view first
    const mobilePath = path.join(ARTIFACTS_DIR, 'mobile_390x844.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log('Saved Mobile Landing:', mobilePath);

    // Test Mobile Menu Open
    const menuToggle = await page.$('header button.mobile-toggle-btn');
    if (menuToggle) {
      await menuToggle.click();
      await new Promise((r) => setTimeout(r, 600));
      const mobileMenuPath = path.join(ARTIFACTS_DIR, 'mobile_menu_390x844.png');
      await page.screenshot({ path: mobileMenuPath, fullPage: false });
      console.log('Saved Mobile Menu:', mobileMenuPath);
    }

    // 5. Reduced Motion Audit
    console.log('Testing prefers-reduced-motion mode...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));
    const reducedMotionPath = path.join(ARTIFACTS_DIR, 'reduced_motion_desktop.png');
    await page.screenshot({ path: reducedMotionPath, fullPage: false });
    console.log('Saved Reduced Motion:', reducedMotionPath);

    console.log('\n--- Visual QA Results ---');
    console.log('Console Errors Count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    } else {
      console.log('Console is completely clean!');
    }
  } finally {
    await browser.close();
  }
}

runVisualQA().catch((err) => {
  console.error('Visual QA error:', err);
  process.exit(1);
});
