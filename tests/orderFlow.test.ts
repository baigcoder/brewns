import { describe, expect, it } from 'bun:test';
import { customerStage, FLOW, pkDay, pkMinutes, stageTimes, stationFor, statusAfterStations, stationsOf } from '@/lib/orderFlow';

describe('order flow', () => {
  it('routes products to the right station', () => {
    expect(stationFor('kitchen')).toBe('kitchen');
    expect(stationFor('drinks')).toBe('bar');
    expect(stationFor('bakery')).toBe('bar');
    expect(stationFor('beans')).toBe('counter');
    expect(stationsOf([{ station: 'bar' }, { station: 'counter' }, { station: 'bar' }])).toEqual(['bar']);
  });

  it('moves to making when any station starts and to ready when all are done', () => {
    expect(statusAfterStations({ status: 'accepted', stations: { bar: 'queued', kitchen: 'queued' } })).toBe('accepted');
    expect(statusAfterStations({ status: 'accepted', stations: { bar: 'making', kitchen: 'queued' } })).toBe('preparing');
    expect(statusAfterStations({ status: 'preparing', stations: { bar: 'done', kitchen: 'queued' } })).toBe('preparing');
    expect(statusAfterStations({ status: 'preparing', stations: { bar: 'done', kitchen: 'done' } })).toBe('ready');
    expect(statusAfterStations({ status: 'onway', stations: { bar: 'done' } })).toBe('onway');
  });

  it('shows a delivery as with the rider once one is assigned', () => {
    const rider = { id: 'r', name: 'Ali', plate: 'LEA-1' };
    expect(customerStage({ status: 'accepted', mode: 'delivery', rider })).toBe('rider');
    expect(customerStage({ status: 'ready', mode: 'delivery', rider: null })).toBe('preparing');
    expect(customerStage({ status: 'ready', mode: 'pickup', rider: null })).toBe('ready');
    expect(customerStage({ status: 'cancelled', mode: 'delivery', rider })).toBe('cancelled');
  });

  it('fills in steps the café skipped', () => {
    const times = stageTimes({ mode: 'pickup', placed: 1000, events: [{ t: 5000, what: 'ready', status: 'ready' }] });
    expect(times.received).toBe(1000);
    expect(times.accepted).toBe(5000);
    expect(times.preparing).toBe(5000);
    expect(times.ready).toBe(5000);
  });

  it('every mode ends in a done status', () => {
    expect(FLOW.pickup.at(-1)).toBe('collected');
    expect(FLOW.delivery.at(-1)).toBe('delivered');
    expect(FLOW.dinein.at(-1)).toBe('served');
  });

  it('reads Lahore time (UTC+5)', () => {
    const t = Date.UTC(2026, 0, 1, 20, 30); // 01:30 on 2 Jan in Lahore
    expect(pkDay(t)).toBe('2026-01-02');
    expect(pkMinutes(t)).toBe(90);
  });
});
