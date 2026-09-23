import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function testNav() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for preloader to complete...');
    await page.waitForFunction(() => !document.getElementById('pre'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('Clicking "Reviews" link in header...');
    const clicked = await page.evaluate(() => {
      const link = document.querySelector('header a[href="#reviews"]');
      if (link) {
        link.click();
        return true;
      }
      return false;
    });
    console.log('Link clicked:', clicked);

    // Wait 1.8 seconds for smooth scroll animation to finish
    await new Promise((r) => setTimeout(r, 1800));

    const check = await page.evaluate(() => {
      const reviews = document.getElementById('reviews');
      const hdr = document.getElementById('hdr');
      const h2 = document.querySelector('.reviews-h2');
      const rRect = reviews.getBoundingClientRect();
      const hRect = hdr.getBoundingClientRect();
      const h2Rect = h2.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        reviewsRect: { top: rRect.top, bottom: rRect.bottom, height: rRect.height },
        hdrRect: { top: hRect.top, bottom: hRect.bottom, height: hRect.height },
        h2Rect: { top: h2Rect.top, bottom: h2Rect.bottom },
        clearanceBetweenHdrAndH2: h2Rect.top - hRect.bottom
      };
    });
    console.log('Layout check:', JSON.stringify(check, null, 2));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'nav_to_reviews_result.png') });
    console.log('Saved to nav_to_reviews_result.png');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

testNav();
