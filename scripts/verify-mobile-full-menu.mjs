import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2500);

  // Scroll to menu
  await page.evaluate(() => {
    document.querySelector('#menu')?.scrollIntoView({ behavior: 'instant' });
  });
  await delay(800);

  // Click VIEW FULL MENU
  await page.click('#menu-cta');
  await delay(800);

  const mobileModalImg = path.join(ARTIFACTS_DIR, 'mobile_full_menu_modal.png');
  await page.screenshot({ path: mobileModalImg });
  console.log(`Saved ${mobileModalImg}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
