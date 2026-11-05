import { afterEach, describe, expect, it } from 'bun:test';
import { clientIp } from '@/lib/server/http';

const req = (h: Record<string, string>) => new Request('https://x.test/', { headers: h });
const keep = { s: process.env.LOADTEST_SECRET, v: process.env.VERCEL_ENV };
afterEach(() => {
  if (keep.s === undefined) delete process.env.LOADTEST_SECRET; else process.env.LOADTEST_SECRET = keep.s;
  if (keep.v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = keep.v;
});

describe('client address for rate limits', () => {
  const asked = { 'x-forwarded-for': '9.9.9.9', 'x-loadtest-ip': '10.1.2.3', 'x-loadtest-secret': 'right-secret' };
  it('uses the real forwarded address normally', () => expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))).toBe('9.9.9.9'));
  it('honours a load-test address only on a preview with the right secret', () => {
    process.env.LOADTEST_SECRET = 'right-secret';
    process.env.VERCEL_ENV = 'preview';
    expect(clientIp(req(asked))).toBe('10.1.2.3');
    expect(clientIp(req({ ...asked, 'x-loadtest-secret': 'wrong' }))).toBe('9.9.9.9');
  });
  it('never honours it in production, even with the right secret', () => {
    process.env.LOADTEST_SECRET = 'right-secret';
    process.env.VERCEL_ENV = 'production';
    expect(clientIp(req(asked))).toBe('9.9.9.9');
  });
  it('is off when no secret is configured', () => {
    delete process.env.LOADTEST_SECRET;
    process.env.VERCEL_ENV = 'preview';
    expect(clientIp(req(asked))).toBe('9.9.9.9');
  });
});
