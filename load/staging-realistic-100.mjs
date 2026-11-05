// Realistic 100-customer test for the STAGING preview only (never production). Node 18+, no install.
//   BASE_URL=https://<preview>.vercel.app BYPASS_FILE=<vercel bypass secret file> LOADTEST_FILE=<LOADTEST_SECRET file> \
//   OWNER_PASS_FILE=<staging owner password file> [SCALE=0.2] node load/staging-realistic-100.mjs
// Each virtual customer has its own client address (the preview honours it only with the load-test secret), so the app's
// per-address limits behave as they would for real people. Who is simulated (100 in all):
//   50 ORDERERS  browse, place an order (guest, for tomorrow), then keep checking the order status ("ordering and waiting"),
//                some tap twice at once (same idempotency key), then order again
//   15 REVIEWERS read reviews, write one (it waits for approval), mark one helpful
//   15 AI CALLERS ask for a call line, then do what a call does on the server: check a table, ask about an order
//   15 BROWSERS  the homepage, shop pages, status and reviews, with think time
//    5 STAFF     the owner's screen, refreshing the live feed every 3 s
// The AI provider itself (Gemini/Groq/ElevenLabs) is not called: only the app's own call endpoints are exercised.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!base || /brewns-chi\.vercel\.app/.test(base)) throw new Error('Set BASE_URL to the staging preview, never production.');
const read = (v) => (process.env[v] ? readFileSync(process.env[v], 'utf8').trim() : '');
const bypass = read('BYPASS_FILE'), lt = read('LOADTEST_FILE'), ownerPass = read('OWNER_PASS_FILE');
if (!lt) throw new Error('LOADTEST_FILE is required so each virtual customer gets its own address.');
const scale = Number(process.env.SCALE || 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hex = (n) => randomBytes(n).toString('hex');

const T0 = Date.now();
const RAMP = 120_000 * scale, HOLD = 300_000 * scale, DOWN = 60_000 * scale, TOTAL = RAMP + HOLD + DOWN;
const stats = new Map(); // "persona METHOD path" -> {ms:[], codes:{}}
const counters = { ordersCreated: 0, orderRetries: 0, duplicateOrders: 0, statusPolls: 0, reviewsWritten: 0, calls: 0 };
const orderNumbers = new Map(); // idempotency key -> number (to catch duplicates)
const samples = new Map();
const htmlSamples = [];
const rec = (k, ms, code) => { const s = stats.get(k) || { ms: [], codes: {} }; s.ms.push(ms); s.codes[code] = (s.codes[code] || 0) + 1; stats.set(k, s); };
const active = (i, n) => { // VU i of n is running when the ramp has reached it
  const t = Date.now() - T0;
  if (t >= TOTAL) return false;
  const f = t < RAMP ? t / RAMP : t < RAMP + HOLD ? 1 : 1 - (t - RAMP - HOLD) / DOWN;
  return i < Math.ceil(f * n);
};
const done = () => Date.now() - T0 >= TOTAL;

function client(id) {
  const ip = `10.${(id >> 8) & 255}.${id & 255}.${(id * 7) % 250 + 1}`;
  const h = { 'content-type': 'application/json', 'x-loadtest-secret': lt, 'x-loadtest-ip': ip };
  if (bypass) h['x-vercel-protection-bypass'] = bypass;
  let cookie = '';
  const fn = async (persona, method, path, body, extra = {}) => {
    const s = performance.now();
    let code = 'ERR', json = null;
    try {
      const r = await fetch(base + path, { method, headers: { ...h, ...(cookie ? { cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
      code = r.status;
      const sc = r.headers.getSetCookie?.() || [];
      if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
      const txt = await r.text();
      try { json = JSON.parse(txt); } catch {}
      if (method === 'POST' && path === '/api/orders' && code === 200 && !json) {
        counters.htmlInsteadOfOrder = (counters.htmlInsteadOfOrder || 0) + 1;
        if ((counters.htmlInsteadOfOrder || 0) <= 3) htmlSamples.push({ t: Math.round((Date.now() - T0) / 1000) + 's', ct: r.headers.get('content-type'), mitigated: r.headers.get('x-vercel-mitigated'), server: r.headers.get('server'), cache: r.headers.get('x-vercel-cache'), title: (txt.match(/<title>([^<]*)/) || [])[1], visible: txt.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220) });
      }
      const sk = `${persona} ${method} ${path.replace(/\/\d+/g, '/N').replace(/\?.*$/, '')} ${code}`;
      if (!samples.has(sk) && (code >= 400 || (method === 'POST' && path === '/api/orders' && !json?.order))) samples.set(sk, txt.slice(0, 200));
    } catch {}
    rec(`${persona} ${method} ${path.replace(/\/\d+/g, '/N').replace(/\?.*$/, '')}`, performance.now() - s, code);
    return { code, json };
  };
  fn.cookie = () => cookie;
  fn.setCookie = (c) => { cookie = c; };
  return fn;
}

const tomorrow = new Date(Date.now() + 86400000 + 5 * 3600000).toISOString().slice(0, 10);
const orderBody = (phone) => ({
  items: [pick([{ id: 'americano', sel: { size: 1, temp: 0, shots: 0 } }, { id: 'cortado', sel: { shots: 0, milk: 0, temp: 0 } }, { id: 'flat-white', sel: { milk: 0, temp: 0 } }, { id: 'latte', sel: { size: 1, milk: 0, temp: 0 } }])].map((i) => ({ ...i, qty: 1 + Math.floor(Math.random() * 2) })),
  mode: 'pickup', loc: Math.floor(Math.random() * 3), area: null, table: null, address: '', when: { t: 720 + 15 * Math.floor(Math.random() * 8), tomorrow: true },
  name: 'Load Test', phone, email: '', note: '', pay: 0, promo: '', useReward: false,
});

async function orderer(i) {
  const f = client(i); let n = 0;
  while (!done()) {
    if (!active(i, 50)) { await sleep(1000); continue; }
    await f('orderer', 'GET', '/'); await sleep(800 + Math.random() * 2000);
    await f('orderer', 'GET', '/shop/cortado'); await sleep(800 + Math.random() * 2000);
    const phone = '03' + String(100000000 + ((i * 100003 + n * 7919 + Math.floor(Math.random() * 1e6)) % 899999999)).slice(0, 9);
    const key = hex(12), body = orderBody(phone);
    // 15% tap twice at once
    const twice = Math.random() < 0.15;
    const go = () => f('orderer', 'POST', '/api/orders', body, { 'idempotency-key': key });
    const results = twice ? await Promise.all([go(), go()]) : [await go()];
    if (twice) counters.orderRetries++;
    const created = results.filter((r) => r.code === 201 || r.code === 200).map((r) => r.json?.order?.number).filter(Boolean);
    const first = results.find((r) => r.json?.order?.number);
    if (new Set(created).size > 1) counters.duplicateOrders++;
    if (!first) { await sleep(3000); n++; continue; }
    counters.ordersCreated++;
    const num = first.json.order.number, k = first.json.key;
    if (orderNumbers.has(key) && orderNumbers.get(key) !== num) counters.duplicateOrders++;
    orderNumbers.set(key, num);
    // wait for it: check the status every 3 to 5 seconds for 30 to 60 seconds
    const until = Date.now() + 30000 + Math.random() * 30000;
    while (Date.now() < until && !done()) { await sleep(3000 + Math.random() * 2000); await f('orderer', 'GET', `/api/orders/${num}?k=${k}`); counters.statusPolls++; }
    n++; await sleep(2000 + Math.random() * 4000);
  }
}

async function reviewer(i) {
  const f = client(1000 + i);
  while (!done()) {
    if (!active(i, 15)) { await sleep(1000); continue; }
    const r = await f('reviewer', 'GET', '/api/public/reviews'); await sleep(2000 + Math.random() * 3000);
    const w = await f('reviewer', 'POST', '/api/public/reviews', { action: 'add', quote: 'Great coffee and quick service, load test review.', name: 'Load Tester', place: 'Gulberg', stars: 4 + Math.floor(Math.random() * 2) });
    if (w.code === 201) counters.reviewsWritten++;
    const rid = r.json?.reviews?.[0]?.id; if (rid) await f('reviewer', 'POST', '/api/public/reviews', { action: 'upvote', id: rid });
    await sleep(20000 + Math.random() * 20000);
  }
}

async function caller(i) {
  const f = client(2000 + i);
  while (!done()) {
    if (!active(i, 15)) { await sleep(1000); continue; }
    const callId = hex(10);
    await f('ai-caller', 'POST', '/api/voice/live', { callId, gender: 'female', lang: 'en' });
    counters.calls++;
    for (let t = 0; t < 4 && !done(); t++) {
      await sleep(4000 + Math.random() * 4000);
      await f('ai-caller', 'POST', '/api/voice/live/tool', { callId, name: 'check_table', args: { shop: 0, guests: 2, date: tomorrow, time: '19:00' }, transcript: 'is there a table for two tomorrow at seven' });
    }
    await f('ai-caller', 'POST', '/api/voice/live/tool', { callId, name: 'check_order', args: { number: 1001, phone: '0300' + String(1000000 + i) }, transcript: 'where is my order' });
    await sleep(15000 + Math.random() * 15000);
  }
}

async function browser(i) {
  const f = client(3000 + i);
  while (!done()) {
    if (!active(i, 15)) { await sleep(1000); continue; }
    await f('browser', 'GET', pick(['/', '/shop/cortado', '/gift-cards', '/careers', '/reserve'])); await sleep(1500 + Math.random() * 3000);
    await f('browser', 'GET', '/api/public/status'); await f('browser', 'GET', '/api/public/reviews'); await f('browser', 'GET', '/api/public/moments');
    await sleep(5000 + Math.random() * 8000);
  }
}

// One owner login shared by the five staff screens (a real café signs in once per screen; the app also limits sign-ins per account).
let staffCookie = null, staffSigningIn = null;
async function staffLogin() {
  const f = client(4999);
  const s = await f('staff', 'POST', '/api/auth/signin', { kind: 'staff', email: 'owner@staging.example.com', password: ownerPass });
  if (s.code !== 200) return null;
  return f.cookie();
}
async function staff(i) {
  while (!done()) {
    if (!active(i, 5)) { await sleep(1000); continue; }
    staffSigningIn ||= staffLogin().then((c) => { staffCookie = c; return c; });
    await staffSigningIn;
    if (!staffCookie) { await sleep(10000); continue; }
    const f = client(4000 + i); f.setCookie(staffCookie);
    let v = '';
    for (let t = 0; t < 60 && !done(); t++) {
      const r = await f('staff', 'GET', `/api/staff/live${v ? `?v=${v}` : ''}`);
      if (r.json?.v !== undefined) v = r.json.v;
      await sleep(3000);
    }
  }
}

// A deployment that is still building answers every request with a "Deployment is building" page and status 200, so wait for the
// app's own JSON health answer before starting; otherwise those pages are counted as failed orders.
for (let i = 0; ; i++) {
  try {
    const r = await fetch(base + '/api/health', { headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {} });
    if ((await r.json()).ok === true) break;
  } catch {}
  if (i > 90) throw new Error('The preview never answered with its health JSON.');
  await sleep(4000);
}
console.log(`Starting: 100 virtual customers, ${(TOTAL / 60000).toFixed(1)} min  (ramp ${(RAMP / 1000) | 0}s, hold ${(HOLD / 1000) | 0}s, down ${(DOWN / 1000) | 0}s)`);
await Promise.all([
  ...Array.from({ length: 50 }, (_, i) => orderer(i)),
  ...Array.from({ length: 15 }, (_, i) => reviewer(i)),
  ...Array.from({ length: 15 }, (_, i) => caller(i)),
  ...Array.from({ length: 15 }, (_, i) => browser(i)),
  ...Array.from({ length: 5 }, (_, i) => staff(i)),
]);

const q = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
let n = 0, bad = 0, limited = 0; const allMs = [];
console.log('\n' + 'route'.padEnd(40), 'n'.padStart(6), 'p50'.padStart(6), 'p95'.padStart(6), 'p99'.padStart(6), ' codes');
for (const [k, s] of [...stats].sort()) {
  n += s.ms.length; allMs.push(...s.ms);
  for (const [c, v] of Object.entries(s.codes)) { if (c === 'ERR' || Number(c) >= 500) bad += v; if (c === '429' || c === '503') limited += v; }
  console.log(k.padEnd(40), String(s.ms.length).padStart(6), q(s.ms, .5).toFixed(0).padStart(6), q(s.ms, .95).toFixed(0).padStart(6), q(s.ms, .99).toFixed(0).padStart(6), ' ', JSON.stringify(s.codes));
}
const ord = [...stats].filter(([k]) => k === 'orderer POST /api/orders').flatMap(([, s]) => s.ms);
console.log(`\nrequests ${n}   5xx/errors ${bad} (${((bad / n) * 100).toFixed(2)}%)   429/503 (limits, graceful) ${limited}   overall p95 ${q(allMs, .95).toFixed(0)}ms p99 ${q(allMs, .99).toFixed(0)}ms`);
console.log(`order POST p50 ${q(ord, .5).toFixed(0)}ms p95 ${q(ord, .95).toFixed(0)}ms p99 ${q(ord, .99).toFixed(0)}ms`);
for (const h of htmlSamples) console.log('HTML instead of an order:', JSON.stringify(h));
console.log('HTML-instead-of-order responses:', counters.htmlInsteadOfOrder || 0);
for (const [k, v] of samples) console.log('sample', k, '=>', v.replace(/\s+/g, ' '));
console.log(`orders created ${counters.ordersCreated}  double-tap tests ${counters.orderRetries}  duplicate orders from retries ${counters.duplicateOrders}  status checks ${counters.statusPolls}  reviews written ${counters.reviewsWritten}  call sessions ${counters.calls}`);
