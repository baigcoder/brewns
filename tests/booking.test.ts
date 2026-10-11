import { describe, expect, it } from 'bun:test';
import { BOOK_AHEAD_DAYS, bookingMinutes, bookingProblem, newBookingCode, tablesFor, uniqueBookingCode, withinBookAhead, type Booked } from '@/lib/booking';

const b = (over: Partial<Booked> = {}): Booked => ({ loc: 0, date: '2026-03-10', time: '12:30 PM', guests: 2, status: 'confirmed', phone: '+92 300 1111111', ...over });
const want = { loc: 0, date: '2026-03-10', time: '12:30 PM', guests: 2, phone: '0300 2222222' };

describe('newBookingCode', () => {
  it('is RES-/PTY- and six digits, from 100000 up', () => {
    expect(newBookingCode('RES', () => 0)).toBe('RES-100000');
    expect(newBookingCode('PTY', () => 899999)).toBe('PTY-999999');
    expect(/^RES-\d{6}$/.test(newBookingCode('RES'))).toBe(true);
  });
  it('skips a code that is already taken', () => {
    let n = 0;
    const next = () => [5, 5, 7][n++];
    expect(uniqueBookingCode('RES', new Set(['RES-100005']), next)).toBe('RES-100007');
    expect(uniqueBookingCode('RES', new Set(), () => 9)).toBe('RES-100009');
  });
  it('gives up rather than loop forever if every code is taken', () => {
    expect(() => uniqueBookingCode('RES', { has: () => true } as unknown as Set<string>, () => 1)).toThrow();
  });
});

describe('bookingMinutes', () => {
  it('reads the website format and the phone-line format as the same slot', () => {
    expect(bookingMinutes('12:30 PM')).toBe(750);
    expect(bookingMinutes('12:30')).toBe(750);
    expect(bookingMinutes('05:00 PM')).toBe(bookingMinutes('17:00'));
    expect(bookingMinutes('late')).toBeNull();
  });
});

describe('tablesFor', () => {
  it('seats four to a table', () => {
    expect([1, 4, 5, 8, 9].map(tablesFor)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe('bookingProblem', () => {
  it('allows a free slot', () => {
    expect(bookingProblem([], want, 12)).toBe('');
    expect(bookingProblem([b()], want, 12)).toBe('');
  });

  it('stops the same guest booking the same slot twice, however the number is written', () => {
    expect(bookingProblem([b({ phone: '03002222222' })], { ...want, phone: '+92 300 2222222' }, 12)).toContain('already have a booking');
    expect(bookingProblem([b({ phone: '0300 3333333' })], want, 12)).toBe(''); // a different guest
    expect(bookingProblem([b({ phone: '0300 2222222' })], want, 12)).toContain('already have a booking');
  });

  it('counts the phone-line format of the same slot', () => {
    expect(bookingProblem([b({ time: '12:30', phone: '0300 2222222' })], want, 12)).toContain('already have a booking');
  });

  it('stops at the shop\'s number of tables, counting big groups as several', () => {
    const full = [b({ guests: 8, phone: '1' }), b({ guests: 4, phone: '2' })]; // 2 + 1 tables
    expect(bookingProblem(full, { ...want, guests: 4 }, 4)).toBe('');
    expect(bookingProblem(full, { ...want, guests: 5 }, 4)).toContain('fully booked');
  });

  it('ignores cancelled bookings, other shops, other days and other times', () => {
    const others = [b({ status: 'cancelled', guests: 40 }), b({ loc: 1, guests: 40 }), b({ date: '2026-03-11', guests: 40 }), b({ time: '02:00 PM', guests: 40 })];
    expect(bookingProblem(others, want, 2)).toBe('');
  });
});

describe('withinBookAhead', () => {
  it('allows up to the limit and no further', () => {
    expect(BOOK_AHEAD_DAYS).toBe(60);
    expect(withinBookAhead('2026-05-09', '2026-03-10')).toBe(true);
    expect(withinBookAhead('2026-05-10', '2026-03-10')).toBe(false);
  });
});
