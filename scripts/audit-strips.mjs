// Builds one image per product from audit-3d.mjs output: photo | model 0 | 90 | 180 | relief.
// Usage: node scripts/audit-strips.mjs <dir>
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const dir = process.argv[2];
const rows = fs.readFileSync(path.join(dir, 'index.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const b64 = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, n + '.png')).toString('base64');
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: process.env.TEMP + '/strip-' + Date.now() });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 300 });
const per = Number(process.env.PER || 4);
for (let i = 0; i < rows.length; i += per) {
  const chunk = rows.slice(i, i + per);
  const html = '<body style="margin:0;background:#888;font:12px monospace">' + chunk.map((r) => `<div style="display:flex;gap:2px;margin-bottom:2px"><b style="width:90px;color:#fff">${r.id}</b>${r.shots.filter((s) => process.env.ALL === '1' || !s.includes('-var-')).map((s) => `<div style="width:290px;height:300px;overflow:hidden"><img src="${b64(s)}" style="width:290px;height:300px;object-fit:${process.env.FIT || 'cover'}"></div>`).join('')}</div>`).join('') + '</body>';
  await page.setContent(html);
  await page.setViewport({ width: 1500, height: 302 * chunk.length });
  await page.screenshot({ path: path.join(dir, `strip-${String(i / per).padStart(2, '0')}.png`) });
}
await browser.close();
