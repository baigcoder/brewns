import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function testMobileReviews() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('pre'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    await page.evaluate(() => {
      const el = document.getElementById('reviews');
      if (window.lenis) window.lenis.scrollTo(el, { immediate: true });
      else el?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'mobile_reviews_scrolled.png') });
    console.log('Mobile reviews screenshot saved!');
  } finally {
    await browser.close();
  }
}

testMobileReviews();
