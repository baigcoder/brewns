import { describe, expect, it } from 'bun:test';
import { dayKey, funnelSteps, isEvent, lastDays } from '@/lib/server/events';

const day = (visit: number, add_to_bag: number, bag_open: number, checkout_start: number, order_placed: number) => ({ visit, add_to_bag, bag_open, checkout_start, order_placed });

describe('dayKey', () => {
  it('uses Pakistan time (UTC+5), so a late evening in UTC is already tomorrow', () => {
    expect(dayKey(Date.UTC(2026, 0, 10, 18, 59))).toBe('2026-01-10');
    expect(dayKey(Date.UTC(2026, 0, 10, 19, 0))).toBe('2026-01-11');
  });
});

describe('lastDays', () => {
  it('lists n days ending today, oldest first', () => {
    expect(lastDays(3, Date.UTC(2026, 2, 1, 6))).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('isEvent', () => {
  it('accepts only the known funnel steps', () => {
    expect(isEvent('visit')).toBe(true);
    expect(isEvent('order_placed')).toBe(true);
    expect(isEvent('drop table')).toBe(false);
    expect(isEvent(7)).toBe(false);
  });
});

describe('funnelSteps', () => {
  it('adds the days up and shows the share of visits and of the step before', () => {
    const steps = funnelSteps([day(100, 40, 30, 20, 10), day(100, 20, 10, 10, 5)]);
    expect(steps.map((s) => s.count)).toEqual([200, 60, 40, 30, 15]);
    expect(steps[0].ofVisits).toBeNull();
    expect(steps[1].ofVisits).toBe(30);
    expect(steps[4].ofVisits).toBe(7.5);
    expect(steps[4].ofPrevious).toBe(50);
  });

  it('shows nothing rather than dividing by zero, and never goes past 100%', () => {
    const none = funnelSteps([day(0, 0, 0, 0, 0)]);
    expect(none.every((s) => s.ofVisits === null)).toBe(true);
    expect(funnelSteps([day(5, 9, 0, 0, 0)])[1].ofVisits).toBe(100);
  });
});
