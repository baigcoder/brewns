// Safe order-flow check for the STAGING preview only (never production). Node 18+, no install.
//   BASE_URL=https://<preview>.vercel.app BYPASS_FILE=<file> OWNER_CODE_FILE=<file> OWNER_PASS_FILE=<file> node load/staging-orders.mjs
// Orders are scheduled for tomorrow (shops close at 21:00), guest, pickup, with idempotency keys. One IP may place
// 12 orders per 10 minutes by design, so this sends 12 POSTs that should succeed or replay, then a 13th that must be 429.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!base || /brewns-chi\.vercel\.app/.test(base)) throw new Error('Set BASE_URL to the staging preview, never production.');
const read = (v) => (process.env[v] ? readFileSync(process.env[v], 'utf8').trim() : '');
const headers = { 'content-type': 'application/json' };
if (read('BYPASS_FILE')) headers['x-vercel-protection-bypass'] = read('BYPASS_FILE');

const lat = [];
const post = async (path, body, extra = {}) => {
  const s = performance.now();
  const r = await fetch(base + path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  lat.push(performance.now() - s);
  return { status: r.status, json: j };
};
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// 1. Staging owner (orders stay closed until a café owner exists).
const code = read('OWNER_CODE_FILE'), pass = read('OWNER_PASS_FILE');
if (code && pass) {
  const o = await post('/api/auth/owner-signup', { name: 'Staging Owner', email: 'owner@staging.example.com', password: pass, code });
  check('owner exists (created or already there)', o.status === 200 || o.status === 409, `status ${o.status}`);
}

const phone = () => '03' + String(Math.floor(Math.random() * 9e8) + 1e8); // 03xxxxxxxxx
const order = (extra = {}) => ({
  items: [{ id: 'americano', qty: 1, sel: { size: 1, temp: 0, shots: 0 } }],
  mode: 'pickup', loc: 0, area: null, table: null, address: '', when: { t: 720, tomorrow: true },
  name: 'Load Test', phone: phone(), email: '', note: '', pay: 0, promo: '', useReward: false, ...extra,
});
const key = () => randomBytes(12).toString('hex');

// A. one order, then a retry of the same request
const kA = key(), bA = order();
const a1 = await post('/api/orders', bA, { 'idempotency-key': kA });
check('A1 a new order is created', a1.status === 201 && Number.isInteger(a1.json.order?.number), `status ${a1.status}`);
const a2 = await post('/api/orders', bA, { 'idempotency-key': kA });
check('A2 the retry returns the SAME order', a2.status === 200 && a2.json.order?.number === a1.json.order?.number, `status ${a2.status}`);

// B. the same request sent 4 times at once (a double-tap race)
const kB = key(), bB = order();
const race = await Promise.all(Array.from({ length: 4 }, () => post('/api/orders', bB, { 'idempotency-key': kB })));
const numsB = new Set(race.filter((r) => r.json.order).map((r) => r.json.order.number));
const created = race.filter((r) => r.status === 201).length;
check('B 4 simultaneous identical requests make exactly ONE order', numsB.size === 1 && created === 1, `statuses ${race.map((r) => r.status)}`);

// C. four different orders: each gets its own number
const cs = [];
for (let i = 0; i < 4; i++) cs.push(await post('/api/orders', order(), { 'idempotency-key': key() }));
const numsC = cs.map((r) => r.json.order?.number);
check('C 4 different orders get 4 different numbers', cs.every((r) => r.status === 201) && new Set(numsC).size === 4, `statuses ${cs.map((r) => r.status)}`);

// D. bad input is refused, not stored
const d1 = await post('/api/orders', order({ phone: '123' }), { 'idempotency-key': key() });
check('D bad phone is refused (400)', d1.status === 400, `status ${d1.status}`);

// E. the per-IP limit (12 per 10 minutes) stops the next one with a clear message
const e = await post('/api/orders', order(), { 'idempotency-key': key() });
check('E the 13th request from one IP is rate limited (429)', e.status === 429, `status ${e.status}: ${e.json.error || ''}`);

const distinct = new Set([a1.json.order?.number, ...numsB, ...numsC]).size;
console.log(`\ndistinct orders created: ${distinct} (expected 6)  numbers: ${[...new Set([a1.json.order?.number, ...numsB, ...numsC])].join(', ')}`);
lat.sort((x, y) => x - y);
console.log(`POST latency  p50 ${lat[Math.floor(lat.length * 0.5)].toFixed(0)}ms  p95 ${lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))].toFixed(0)}ms  max ${lat.at(-1).toFixed(0)}ms`);
console.log(results.every(Boolean) && distinct === 6 ? '\nALL CHECKS PASSED' : '\nSOMETHING FAILED');
