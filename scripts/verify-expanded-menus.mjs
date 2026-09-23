import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Baigo/.gemini/antigravity-ide/brain/2ed18bfe-5186-46d3-b4cc-5aa3a7fff77b';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function main() {
  console.log('Launching browser to verify expanded menus...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Wait for preloader to finish
  await page.waitForFunction(() => !document.getElementById('pre') || document.getElementById('pre').style.display === 'none' || document.getElementById('pre').style.visibility === 'hidden' || window.getComputedStyle(document.getElementById('pre')).opacity === '0', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // 1. Scroll to #menu
  console.log('Scrolling to #menu...');
  await page.evaluate(() => {
    const el = document.getElementById('menu');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 1200));

  // Verify menu tabs and items
  const menuInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.menu-tab')).map(t => ({
      text: t.textContent?.trim(),
      cat: t.getAttribute('data-cat'),
      active: t.classList.contains('active') || t.getAttribute('aria-selected') === 'true'
    }));
    const cards = Array.from(document.querySelectorAll('#cards .card')).map(c => ({
      name: c.querySelector('.card-foot p')?.textContent?.trim(),
      price: c.querySelector('.card-foot p:last-child, .card-foot div p')?.textContent?.trim(),
      img: c.querySelector('img')?.getAttribute('src'),
      menuId: c.getAttribute('data-menu-id')
    }));
    const pageText = document.getElementById('menu-page')?.textContent?.trim();
    return { tabs, cards, pageText };
  });
  console.log('Default Menu State:', JSON.stringify(menuInfo, null, 2));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_menu_default_expanded.png') });
  console.log('Captured 01_menu_default_expanded.png');

  // 2. Click COFFEE tab
  console.log('Clicking COFFEE tab in #menu...');
  await page.evaluate(() => {
    const tab = document.querySelector('.menu-tab[data-cat="coffee"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const coffeeCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#cards .card')).map(c => ({
      name: c.querySelector('.card-foot p')?.textContent?.trim(),
      price: c.querySelector('.card-foot p:last-child, .card-foot div p')?.textContent?.trim(),
      menuId: c.getAttribute('data-menu-id')
    }));
  });
  console.log('Coffee Menu Cards:', JSON.stringify(coffeeCards, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_menu_coffee_tab.png') });
  console.log('Captured 02_menu_coffee_tab.png');

  // 3. Click SPECIALTY tab
  console.log('Clicking SPECIALTY tab in #menu...');
  await page.evaluate(() => {
    const tab = document.querySelector('.menu-tab[data-cat="specialty"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_menu_specialty_tab.png') });
  console.log('Captured 03_menu_specialty_tab.png');

  // 4. Click BAKERY tab
  console.log('Clicking BAKERY tab in #menu...');
  await page.evaluate(() => {
    const tab = document.querySelector('.menu-tab[data-cat="bakery"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const bakeryCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#cards .card')).map(c => ({
      name: c.querySelector('.card-foot p')?.textContent?.trim(),
      price: c.querySelector('.card-foot p:last-child, .card-foot div p')?.textContent?.trim(),
      menuId: c.getAttribute('data-menu-id')
    }));
  });
  console.log('Bakery Menu Cards:', JSON.stringify(bakeryCards, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_menu_bakery_tab.png') });
  console.log('Captured 04_menu_bakery_tab.png');

  // 5. Click ALL tab, then click Next arrow
  console.log('Clicking ALL tab, then Next arrow...');
  await page.evaluate(() => {
    const tab = document.querySelector('.menu-tab[data-cat="all"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.evaluate(() => {
    const nextBtn = document.getElementById('menu-next');
    if (nextBtn) nextBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const page2Info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#cards .card')).map(c => ({
      name: c.querySelector('.card-foot p')?.textContent?.trim(),
      price: c.querySelector('.card-foot p:last-child, .card-foot div p')?.textContent?.trim(),
      menuId: c.getAttribute('data-menu-id')
    }));
    const pageText = document.getElementById('menu-page')?.textContent?.trim();
    return { cards, pageText };
  });
  console.log('Page 2 Cards:', JSON.stringify(page2Info, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_menu_carousel_page2.png') });
  console.log('Captured 05_menu_carousel_page2.png');

  // 6. Click a card to open PDP modal (e.g. Cardamom Bun or Cortado)
  console.log('Clicking card to open PDP modal...');
  await page.evaluate(() => {
    const card = document.querySelector('#cards .card');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const pdpInfo = await page.evaluate(() => {
    const pdp = document.getElementById('pdp');
    if (!pdp || pdp.hidden) return null;
    return {
      hidden: pdp.hidden,
      name: document.getElementById('pdp-name')?.textContent?.trim(),
      price: document.getElementById('pdp-price')?.textContent?.trim(),
      kicker: document.querySelector('.pdp-kicker')?.textContent?.trim(),
      desc: document.querySelector('.pdp-desc')?.textContent?.trim(),
      hasPhoto: !!document.querySelector('.pdp-photo'),
      photoSrc: document.querySelector('.pdp-photo')?.getAttribute('src')
    };
  });
  console.log('PDP Modal State:', JSON.stringify(pdpInfo, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_pdp_modal_expanded.png') });
  console.log('Captured 06_pdp_modal_expanded.png');

  // Close PDP modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.pdp-close');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 7. Scroll to #shop
  console.log('Scrolling to #shop...');
  await page.evaluate(() => {
    const shop = document.getElementById('shop');
    if (shop) shop.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 1200));

  const shopInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.shop-tab')).map(t => t.textContent?.trim());
    const count = document.getElementById('shop-count')?.textContent?.trim();
    const items = Array.from(document.querySelectorAll('#shop-grid > li:not([hidden]) .pcard')).map(c => ({
      name: c.querySelector('.pcard-name')?.textContent?.trim(),
      price: c.querySelector('.pcard-price')?.textContent?.trim(),
      tag: c.querySelector('.pcard-tag')?.textContent?.trim()
    }));
    return { tabs, count, itemCount: items.length, items };
  });
  console.log('Shop State:', JSON.stringify(shopInfo, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_shop_all_13_items.png') });
  console.log('Captured 07_shop_all_13_items.png');

  // 8. Click MERCH tab in #shop
  console.log('Clicking MERCH tab in #shop...');
  await page.evaluate(() => {
    const tab = document.querySelector('.shop-tab[data-cat="merch"]');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const merchInfo = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#shop-grid > li:not([hidden]) .pcard')).map(c => ({
      name: c.querySelector('.pcard-name')?.textContent?.trim(),
      price: c.querySelector('.pcard-price')?.textContent?.trim(),
      tag: c.querySelector('.pcard-tag')?.textContent?.trim(),
      img: c.querySelector('img')?.getAttribute('src')
    }));
    return { count: items.length, items };
  });
  console.log('Merch Filtered Items:', JSON.stringify(merchInfo, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_shop_merch_tab.png') });
  console.log('Captured 08_shop_merch_tab.png');

  // 9. Quick Add test
  console.log('Testing quick-add to bag...');
  const initialBagCount = await page.evaluate(() => document.getElementById('bag-count')?.textContent?.trim());
  await page.evaluate(() => {
    const addBtn = document.querySelector('#shop-grid > li:not([hidden]) [data-add]');
    if (addBtn) addBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  const newBagCount = await page.evaluate(() => document.getElementById('bag-count')?.textContent?.trim());
  const toastText = await page.evaluate(() => document.getElementById('toast')?.textContent?.trim());
  console.log(`Bag count changed: ${initialBagCount} -> ${newBagCount}. Toast text: "${toastText}"`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_quick_add_success.png') });
  console.log('Captured 09_quick_add_success.png');

  await browser.close();
  console.log('Verification completed successfully!');
}

main().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});
