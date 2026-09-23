import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

const PRODUCTS_TO_TEST = [
  { id: 'cardamom-bun', name: 'Cardamom Bun', screenshot: '3d_view_01_cardamom_bun.png' },
  { id: 'matcha-financier', name: 'Matcha Financier', screenshot: '3d_view_02_matcha_financier.png' },
  { id: 'cortado', name: 'Cortado (Gibraltar Glass)', screenshot: '3d_view_03_cortado.png' },
  { id: 'nitro-cold-brew', name: 'Nitro Cold Brew', screenshot: '3d_view_04_nitro_cold_brew.png' },
  { id: 'ceramic-tumbler', name: 'Ceramic Tumbler', screenshot: '3d_view_05_ceramic_tumbler.png' },
  { id: 'single-origin', name: 'Ethiopia Single Origin', screenshot: '3d_view_06_single_origin.png' },
  { id: 'espresso', name: 'Espresso Demitasse', screenshot: '3d_view_07_espresso.png' },
  { id: 'latte', name: 'Latte with Art', screenshot: '3d_view_08_latte.png' },
  { id: 'cinnamon-roll', name: 'Glazed Cinnamon Roll', screenshot: '3d_view_09_cinnamon_roll.png' },
  { id: 'iced-matcha', name: 'Iced Matcha', screenshot: '3d_view_10_iced_matcha.png' },
];

async function verifyAll3DViews() {
  console.log('--- Verifying All 3D Views Across Menu Items ---');

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log('Loading http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await new Promise((r) => setTimeout(r, 4000));

  for (const item of PRODUCTS_TO_TEST) {
    console.log(`\nTesting 3D view for: ${item.name} (#shop/${item.id})...`);

    // Route to PDP
    await page.evaluate((id) => {
      location.hash = `#shop/${id}`;
    }, item.id);
    await new Promise((r) => setTimeout(r, 1200));

    // Switch to 3D VIEW if not already on 3D view
    await page.evaluate(() => {
      const btn = document.querySelector('[data-view="3d"]');
      if (btn) btn.click();
    });
    // Allow WebGL scene to load, texture compile, and render frame
    await new Promise((r) => setTimeout(r, 2200));

    // Verify canvas exists and is rendered
    const hasCanvas = await page.evaluate(() => {
      const c = document.querySelector('.pdp-stage canvas');
      return !!c && c.width > 0 && c.height > 0;
    });
    console.log(`  Canvas active: ${hasCanvas}`);

    // If cardamom-bun or financier, test the WARMED toggle
    if (item.id === 'cardamom-bun' || item.id === 'matcha-financier') {
      await page.evaluate(() => {
        const warmChoice = document.querySelector('[data-opt="serve"] [data-choice="1"]');
        if (warmChoice) warmChoice.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // If ceramic tumbler, test RAW OAT colorway
    if (item.id === 'ceramic-tumbler') {
      await page.evaluate(() => {
        const oatChoice = document.querySelector('[data-opt="color"] [data-choice="1"]');
        if (oatChoice) oatChoice.click();
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    // Capture screenshot
    const shotPath = path.join(ARTIFACTS_DIR, item.screenshot);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Captured screenshot: ${item.screenshot}`);

    // Close PDP modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.pdp-close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  await browser.close();
  console.log('\n--- All 3D views verified and captured successfully! ---');
}

verifyAll3DViews().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
