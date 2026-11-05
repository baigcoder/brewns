// Read-only 60-VU capacity test for a STAGING preview (never production). Node 18+, no install.
//   BASE_URL=https://<preview>.vercel.app BYPASS_FILE=<file holding the Vercel automation bypass secret> node load/staging-60.mjs
// Mix: 35 browse, 10 public API, 5 reservation page, 5 sign-in page + session check. Order writes are not included yet.
import { readFileSync } from 'node:fs';

const base = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!base || /brewns-chi\.vercel\.app/.test(base)) throw new Error('Set BASE_URL to the staging preview, never production.');
const bypass = process.env.BYPASS_FILE ? readFileSync(process.env.BYPASS_FILE, 'utf8').trim() : '';
const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
const scale = Number(process.env.SCALE || 1); // 0.1 = a quick smoke run

const groups = [
  { name: 'browse', max: 35, paths: ['/', '/shop/cortado', '/gift-cards', '/careers'] },
  { name: 'public-api', max: 10, paths: ['/api/public/status', '/api/public/reviews', '/api/health'] },
  { name: 'reservation', max: 5, paths: ['/reserve'] },
  { name: 'session', max: 5, paths: ['/account/signin', '/staff/signin', '/api/account/me'] },
];
// ramp 0->17% (10 of 60), ->50% (30), ->100% (60), sustain, ramp down
const stages = [[60, 0.17], [60, 0.5], [60, 1], [300, 1], [60, 0]].map(([s, f]) => [s * scale * 1000, f]);
const total = stages.reduce((a, [ms]) => a + ms, 0);

const stats = new Map(); // key -> {ms:[], codes:{}}
const rec = (key, ms, code) => {
  const s = stats.get(key) || { ms: [], codes: {} };
  s.ms.push(ms); s.codes[code] = (s.codes[code] || 0) + 1; stats.set(key, s);
};
const target = (t) => {
  let prev = 0, acc = 0;
  for (const [ms, f] of stages) { if (t < acc + ms) return prev + (f - prev) * ((t - acc) / ms); acc += ms; prev = f; }
  return 0;
};

const t0 = Date.now();
async function vu(g, idx) {
  while (Date.now() - t0 < total) {
    const active = Math.round(target(Date.now() - t0) * g.max);
    if (idx >= active) { await new Promise((r) => setTimeout(r, 500)); continue; }
    const p = g.paths[Math.floor(Math.random() * g.paths.length)];
    const s = performance.now();
    let code = 'ERR';
    try { const r = await fetch(base + p, { headers, redirect: 'manual' }); code = r.status; await r.arrayBuffer(); } catch {}
    rec(p, performance.now() - s, code);
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 3500)); // think time
  }
}
await Promise.all(groups.flatMap((g) => Array.from({ length: g.max }, (_, i) => vu(g, i))));

const q = (a, p) => a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
let all = [], bad = 0, n = 0;
console.log('route'.padEnd(26), 'n'.padStart(6), 'p50'.padStart(7), 'p95'.padStart(7), 'p99'.padStart(7), ' codes');
for (const [k, s] of [...stats].sort()) {
  all = all.concat(s.ms); n += s.ms.length;
  bad += Object.entries(s.codes).filter(([c]) => c === 'ERR' || Number(c) >= 500).reduce((a, [, v]) => a + v, 0);
  console.log(k.padEnd(26), String(s.ms.length).padStart(6), q(s.ms, .5).toFixed(0).padStart(7), q(s.ms, .95).toFixed(0).padStart(7), q(s.ms, .99).toFixed(0).padStart(7), ' ', JSON.stringify(s.codes));
}
console.log(`\nrequests ${n}  5xx/errors ${bad} (${((bad / n) * 100).toFixed(2)}%)  p95 ${q(all, .95).toFixed(0)}ms  p99 ${q(all, .99).toFixed(0)}ms`);
