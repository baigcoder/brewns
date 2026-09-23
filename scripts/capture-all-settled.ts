import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 4000));

  const sections = ['locations', 'story', 'order', 'ftr'];
  for (const s of sections) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if ((window as any).lenis && el) (window as any).lenis.scrollTo(el, { immediate: true });
      window.dispatchEvent(new Event('scroll'));
    }, s);
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `section_${s}_settled.png`) });
  }

  // Also test clicking a product card to test the PDP modal
  await page.evaluate(() => {
    const el = document.getElementById('shop');
    if ((window as any).lenis && el) (window as any).lenis.scrollTo(el, { immediate: true });
  });
  await new Promise((r) => setTimeout(r, 800));
  // Click second shop item
  await page.evaluate(() => {
    const item = document.querySelectorAll('#shop-grid > li button')[0] as HTMLElement;
    if (item) item.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pdp_modal_open.png') });

  // Close PDP
  await page.evaluate(() => {
    const closeBtn = document.getElementById('pdp-close') as HTMLElement;
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Open Bag drawer
  await page.evaluate(() => {
    const bagBtn = document.getElementById('bag-open') as HTMLElement;
    if (bagBtn) bagBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'bag_drawer_open.png') });

  await browser.close();
  console.log('Finished capturing all settled screenshots!');
}

main().catch(console.error);
