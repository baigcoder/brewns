import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('Launching browser to test full menu interactions...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for preloader to finish
  await delay(3000);

  // 1. Scroll to menu section
  console.log('Scrolling to #menu...');
  await page.evaluate(() => {
    document.querySelector('#menu')?.scrollIntoView({ behavior: 'instant' });
  });
  await delay(1000);

  // 2. Click the new BEANS & GEAR tab in menu section
  console.log('Testing BEANS & GEAR tab in #menu...');
  const beansTab = await page.$('.menu-tab[data-cat="beans"]');
  if (beansTab) {
    await beansTab.click();
    await delay(600);
    const beansTabImg = path.join(ARTIFACTS_DIR, 'menu_beans_tab_active.png');
    await page.screenshot({ path: beansTabImg });
    console.log(`Saved ${beansTabImg}`);
  }

  // 3. Switch back to ALL FAVORITES
  const allTab = await page.$('.menu-tab[data-cat="all"]');
  if (allTab) {
    await allTab.click();
    await delay(500);
  }

  // 4. Click VIEW FULL MENU button (#menu-cta)
  console.log('Clicking VIEW FULL MENU button (#menu-cta)...');
  const menuCta = await page.$('#menu-cta');
  if (!menuCta) {
    throw new Error('#menu-cta not found!');
  }
  await menuCta.click();
  await delay(1000);

  // Check if modal is visible
  const modalVisible = await page.evaluate(() => {
    const m = document.querySelector('#full-menu-modal');
    return m && !m.hidden && m.classList.contains('open');
  });
  console.log('Is #full-menu-modal open and visible?', modalVisible);

  const fullMenuModalImg = path.join(ARTIFACTS_DIR, 'full_menu_modal_open.png');
  await page.screenshot({ path: fullMenuModalImg });
  console.log(`Saved ${fullMenuModalImg}`);

  // Check how many items and categories are listed in the modal
  const modalInfo = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#full-menu-modal .full-menu-item')].map(el => ({
      name: el.querySelector('.full-menu-item-name')?.textContent?.trim(),
      price: el.querySelector('.full-menu-item-price')?.textContent?.trim(),
      notes: el.querySelector('.full-menu-item-notes')?.textContent?.trim(),
      hasImage: !!el.querySelector('img')
    }));
    const sections = [...document.querySelectorAll('#full-menu-modal .full-menu-sec-title')].map(s => s.textContent?.trim());
    return { count: items.length, items, sections };
  });
  console.log('Modal offerings count:', modalInfo.count);
  console.log('Modal sections:', modalInfo.sections);
  console.log('Items sample:', modalInfo.items.map(i => `${i.name} (${i.price})`));

  // 5. Test Quick Add on Cardamom Bun from within the modal
  console.log('Testing quick add on cardamom bun in modal...');
  await page.evaluate(() => {
    const addBtn = document.querySelector('.full-menu-add-btn[data-fadd="cardamom-bun"]');
    if (addBtn) addBtn.click();
  });
  await delay(800);

  const bagCount = await page.evaluate(() => document.querySelector('#bag-count')?.textContent?.trim());
  console.log('Bag count after adding Cardamom Bun:', bagCount);

  // Scroll down within the modal body to see bakery & roasts
  await page.evaluate(() => {
    const body = document.querySelector('#full-menu-body');
    if (body) body.scrollTop = 450;
  });
  await delay(600);
  const modalScrolledImg = path.join(ARTIFACTS_DIR, 'full_menu_bakery_and_beans.png');
  await page.screenshot({ path: modalScrolledImg });
  console.log(`Saved ${modalScrolledImg}`);

  // 6. Click ORDER AHEAD IN SHOP button in modal
  console.log('Clicking ORDER AHEAD IN SHOP button in modal...');
  await page.evaluate(() => {
    const toShopBtn = document.querySelector('#full-menu-to-shop');
    if (toShopBtn) toShopBtn.click();
  });
  await delay(1600);

  // Verify modal is closed and shop grid shows all items
  const shopStatus = await page.evaluate(() => {
    const modal = document.querySelector('#full-menu-modal');
    const modalHidden = modal ? (modal.hidden || !modal.classList.contains('open')) : true;
    const activeTab = document.querySelector('.shop-tab[aria-selected="true"]')?.textContent?.trim();
    const countText = document.querySelector('#shop-count')?.textContent?.trim();
    const visibleCards = [...document.querySelectorAll('#shop-grid > li:not([hidden])')].map(li =>
      li.querySelector('.pcard-name')?.textContent?.trim()
    );
    return { modalHidden, activeTab, countText, visibleCardsCount: visibleCards.length, visibleCards };
  });
  console.log('Shop status after clicking ORDER AHEAD IN SHOP:', shopStatus);

  const shopImg = path.join(ARTIFACTS_DIR, 'shop_all_13_items_after_menu_cta.png');
  await page.screenshot({ path: shopImg });
  console.log(`Saved ${shopImg}`);

  await browser.close();
  console.log('All tests completed successfully!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
