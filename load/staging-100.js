/* Run only against a staging deployment with staging Redis/providers:
 * BASE_URL=https://your-preview.vercel.app k6 run load/staging-100.js
 *
 * This is deliberately read-heavy: it never creates real orders or bookings.
 * Add authenticated test accounts and a dedicated test-shop scenario before
 * exercising writes, so load testing cannot affect customer data.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    browse: { executor: 'ramping-vus', exec: 'browse', startVUs: 0, stages: [{ duration: '1m', target: 50 }, { duration: '5m', target: 70 }, { duration: '1m', target: 0 }], gracefulRampDown: '20s' },
    public_api: { executor: 'ramping-vus', exec: 'publicApi', startTime: '15s', startVUs: 0, stages: [{ duration: '1m', target: 15 }, { duration: '5m', target: 20 }, { duration: '1m', target: 0 }] },
    health: { executor: 'constant-vus', exec: 'health', startTime: '15s', vus: 10, duration: '6m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
  },
};

const base = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (!base) throw new Error('Set BASE_URL to a staging deployment, never production.');

export function browse() {
  const res = http.get(`${base}/`);
  check(res, { 'home 200': (r) => r.status === 200, 'has café shell': (r) => r.body.includes('brewns') });
  sleep(2 + Math.random() * 4);
}

export function publicApi() {
  const responses = http.batch(['api/public/status', 'api/public/reviews', 'api/public/moments'].map((path) => ['GET', `${base}/${path}`]));
  responses.forEach((res) => check(res, { 'public API 200': (r) => r.status === 200 }));
  sleep(5 + Math.random() * 5);
}

export function health() {
  const res = http.get(`${base}/api/health`);
  check(res, { 'platform ready': (r) => r.status === 200 && r.json('ok') === true });
  sleep(10);
}
