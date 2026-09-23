import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    
    console.log('Navigating to http://localhost:3000/#reviews ...');
    await page.goto('http://localhost:3000/#reviews', { waitUntil: 'domcontentloaded', timeout: 20000 });

    console.log('Waiting for preloader #pre to disappear...');
    await page.waitForFunction(() => !document.getElementById('pre'), { timeout: 15000 });
    console.log('Preloader dismissed!');

    // Wait a brief moment for page reveal transition
    await new Promise((r) => setTimeout(r, 1200));

    // Scroll to #reviews explicitly using Lenis or native
    await page.evaluate(() => {
      const el = document.getElementById('reviews');
      if (window.lenis) {
        window.lenis.scrollTo(el, { immediate: true });
      } else if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });

    await new Promise((r) => setTimeout(r, 1500));

    const info = await page.evaluate(() => {
      const el = document.getElementById('reviews');
      const h2 = document.querySelector('.reviews-h2');
      const hdr = document.getElementById('hdr');
      const card = document.querySelector('.review-card');
      const quote = document.querySelector('.review-quote');
      
      return {
        reviewsRect: el ? el.getBoundingClientRect() : null,
        h2Rect: h2 ? h2.getBoundingClientRect() : null,
        hdrRect: hdr ? hdr.getBoundingClientRect() : null,
        quoteRect: quote ? quote.getBoundingClientRect() : null,
        cardRect: card ? card.getBoundingClientRect() : null,
      };
    });
    console.log('Layout info after scroll:', JSON.stringify(info, null, 2));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'reviews_actual_render.png') });
    console.log('Saved to reviews_actual_render.png');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
