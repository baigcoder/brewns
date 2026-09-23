import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function checkOffsets() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('pre'), { timeout: 15000 });

    const sections = await page.evaluate(() => {
      const ids = ['hero', 'menu', 'shop', 'locations', 'story', 'reviews', 'order', 'ftr'];
      return ids.map(id => {
        const el = document.getElementById(id);
        if (!el) return { id, error: 'not found' };
        const rect = el.getBoundingClientRect();
        return {
          id,
          offsetTop: el.offsetTop,
          offsetHeight: el.offsetHeight,
          clientTop: el.clientTop,
          rectTop: rect.top,
          computedPaddingTop: window.getComputedStyle(el).paddingTop,
          computedMarginTop: window.getComputedStyle(el).marginTop,
        };
      });
    });

    console.log(JSON.stringify(sections, null, 2));
  } finally {
    await browser.close();
  }
}

checkOffsets();
