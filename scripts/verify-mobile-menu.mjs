import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Baigo/.gemini/antigravity-ide/brain/2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  // iPhone 14 Pro viewport
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('Navigating to http://localhost:3000 in mobile viewport...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Scroll to #menu
  await page.evaluate(() => {
    const el = document.getElementById('menu');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 1200));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_mobile_menu_expanded.png') });
  console.log('Captured 10_mobile_menu_expanded.png');

  // Also re-capture desktop menu with the new 2.75rem clearance
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900 });
  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await desktopPage.evaluate(() => {
    const el = document.getElementById('menu');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 1000));
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, '01_menu_default_expanded.png') });
  console.log('Re-captured 01_menu_default_expanded.png with perfected alignment!');

  await browser.close();
}

main().catch(console.error);
