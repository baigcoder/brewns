import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let rtc: typeof import('@/lib/server/rtc');
const order = (number: number, over: Record<string, unknown> = {}) => ({ number, mode: 'delivery', status: 'onway', rider: { id: 'r1', name: 'Ali', plate: 'LEA-1' }, ...over }) as never;
const SDP = 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n';
const status = (p: Promise<unknown>) => p.then(() => 200).catch((e) => e.status as number);

beforeAll(async () => {
  rtc = await import('@/lib/server/rtc');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('customer ↔ rider calls', () => {
  it('rings, is answered by the other side, and hangs up', async () => {
    expect(await rtc.callAct(order(1), 'you', { op: 'offer', sdp: SDP })).toMatchObject({ from: 'you', state: 'ringing', answer: null });
    expect(await rtc.liveCalls()).toEqual([{ number: 1, from: 'you', state: 'ringing' }]);
    // the caller can't answer their own call, and a second call can't start over it
    expect(await status(rtc.callAct(order(1), 'you', { op: 'answer', sdp: SDP }))).toBe(409);
    expect(await status(rtc.callAct(order(1), 'rider', { op: 'offer', sdp: SDP }))).toBe(409);
    expect(await rtc.callAct(order(1), 'rider', { op: 'answer', sdp: SDP })).toMatchObject({ state: 'live', answer: SDP });
    expect((await rtc.callAct(order(1), 'rider', { op: 'end' }))?.state).toBe('ended');
    expect(await rtc.liveCalls()).toEqual([]);
  });

  it('is only for a delivery on its way with a rider', async () => {
    expect(await status(rtc.callAct(order(2, { rider: null }), 'you', { op: 'offer', sdp: SDP }))).toBe(409);
    expect(await status(rtc.callAct(order(3, { status: 'delivered' }), 'you', { op: 'offer', sdp: SDP }))).toBe(409);
    expect(await status(rtc.callAct(order(4, { mode: 'pickup' }), 'you', { op: 'offer', sdp: SDP }))).toBe(409);
  });

  it('refuses anything that is not a session description', async () => {
    expect(await status(rtc.callAct(order(5), 'you', { op: 'offer', sdp: '<script>' }))).toBe(400);
    expect(await status(rtc.callAct(order(5), 'you', { op: 'offer', sdp: `v=0${'x'.repeat(30000)}` }))).toBe(400);
  });

  it('stops ringing after 45 seconds', () => {
    const c = { from: 'you' as const, offer: SDP, t: 0 };
    expect(rtc.callState(c, rtc.RING_MS - 1)).toBe('ringing');
    expect(rtc.callState(c, rtc.RING_MS + 1)).toBe('ended');
    expect(rtc.callState({ ...c, answer: SDP }, rtc.RING_MS + 1)).toBe('live');
  });
});
