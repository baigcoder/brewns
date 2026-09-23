import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function testFull() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const results = {};

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('pre'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 1. Verify Card 03 Name
    results.card3Name = await page.evaluate(() => {
      const cards = document.querySelectorAll('#cards .card');
      if (cards.length >= 3) {
        return cards[2].querySelector('.card-foot p:first-child')?.textContent?.trim();
      }
      return null;
    });

    // 2. Test Hero Quick Add
    results.bagCountBefore = await page.evaluate(() => document.getElementById('bag-count')?.textContent);
    await page.evaluate(() => {
      const btn = document.getElementById('hero-quick-add');
      if (btn) btn.click();
    });
    // Wait for droplet flight & toast
    await new Promise((r) => setTimeout(r, 1000));
    results.bagCountAfter = await page.evaluate(() => document.getElementById('bag-count')?.textContent);
    results.toastText = await page.evaluate(() => document.getElementById('toast')?.textContent);

    // 3. Mobile Viewport Reviews Verification
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.evaluate(() => {
      const el = document.getElementById('reviews');
      if (window.lenis) {
        window.lenis.scrollTo(el, { immediate: true });
      } else if (el) {
        el.scrollIntoView({ behavior: 'instant' });
      }
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_reviews_verified.png') });
    console.log('Mobile screenshot saved to mobile_reviews_verified.png');

    console.log('Interaction Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

testFull();
