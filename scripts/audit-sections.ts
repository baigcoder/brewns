import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function auditSections() {
  console.log('--- Starting Comprehensive Section Audit on http://localhost:3000/ ---');

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

  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${text}`);
      } else {
        consoleLogs.push(`[Console ${msg.type()}] ${text}`);
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        networkErrors.push(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

    // 1. Capture Preloader (or immediately after)
    const preExists = await page.evaluate(() => {
      const pre = document.getElementById('pre');
      return pre ? window.getComputedStyle(pre).display !== 'none' : false;
    });
    console.log('Preloader exists on page:', preExists);

    // Wait for preloader to settle (approx 3.2s)
    console.log('Waiting for intro to settle into hero...');
    await new Promise((r) => setTimeout(r, 3500));

    // 2. Hero Section
    console.log('Capturing Hero Section...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_hero_desktop.png') });

    // 3. Menu Section
    console.log('Capturing Menu Section...');
    await page.evaluate(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_menu_section.png') });

    // 4. Shop Section
    console.log('Capturing Shop Section...');
    await page.evaluate(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_shop_section.png') });

    // 5. Locations & Clock Section
    console.log('Capturing Locations & Clock Section...');
    await page.evaluate(() => document.getElementById('locations')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_locations_clock.png') });

    // 6. Philosophy / Story Section
    console.log('Capturing Philosophy / Story Section...');
    await page.evaluate(() => document.getElementById('story')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_philosophy_story.png') });

    // 7. Order / Thermal Printer Section
    console.log('Capturing Order / Thermal Section...');
    await page.evaluate(() => document.getElementById('order')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_order_receipt.png') });

    // 8. Footer Section
    console.log('Capturing Footer Section...');
    await page.evaluate(() => document.getElementById('ftr')?.scrollIntoView({ behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07_footer.png') });

    // 9. Calibrator Modal Test
    console.log('Testing Calibrator Modal...');
    await page.evaluate(() => {
      const btn = document.getElementById('open-calibrator');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '08_calibrator_modal.png') });
    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.getElementById('calibrator-close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 10. Bag Drawer Test
    console.log('Testing Bag Drawer...');
    await page.evaluate(() => {
      const bagBtn = document.getElementById('bag-open');
      if (bagBtn) bagBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '09_bag_drawer.png') });
    // Close bag drawer
    await page.evaluate(() => {
      const bagClose = document.getElementById('bag-close') || document.getElementById('veil');
      if (bagClose) (bagClose as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 11. Mobile Viewport 390x844
    console.log('Capturing Mobile Viewport 390x844...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '10_mobile_hero.png') });

    // Section audit report summary
    const auditReport = await page.evaluate(() => {
      const sections = ['hero', 'menu', 'shop', 'locations', 'story', 'order', 'ftr'];
      return sections.map((id) => {
        const el = document.getElementById(id);
        if (!el) return { id, exists: false };
        const rect = el.getBoundingClientRect();
        return {
          id,
          exists: true,
          tagName: el.tagName,
          width: rect.width,
          height: rect.height,
          childCount: el.childElementCount,
          textContentLength: el.textContent?.length || 0,
        };
      });
    });

    console.log('Section Structure Report:', JSON.stringify(auditReport, null, 2));
    console.log('Console Errors:', consoleErrors);
    console.log('Network Errors:', networkErrors);

    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'audit_report.json'),
      JSON.stringify(
        {
          sections: auditReport,
          consoleErrors,
          networkErrors,
          logCount: consoleLogs.length,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

auditSections().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});
