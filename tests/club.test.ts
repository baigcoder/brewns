import { describe, expect, it } from 'bun:test';
import {
  addStamps,
  birthdayTreat,
  CLUB,
  emptyClub,
  isBirthdayWeek,
  memberNumber,
  reverseOrder,
  rewardValue,
  spendReward,
  stampsFor,
} from '@/components/brewns/club';

describe('brewns Club Loyalty Card', () => {
  it('generates formatted member numbers', () => {
    const num = memberNumber(12345);
    expect(num).toMatch(/^BRW \d{4} \d{4}$/);
  });

  it('calculates 1 stamp per drink on standard afternoon orders', () => {
    const lines = [
      { cat: 'drinks', qty: 2, unit: 650 },
      { cat: 'kitchen', qty: 1, unit: 1800 }, // Food does not earn drink stamps
    ];
    // 2:00 PM = 14:00 = 840 mins
    const stamps = stampsFor(lines, 840, 0);
    expect(stamps).toBe(2);
  });

  it('awards double stamps for early morning orders placed before 09:00', () => {
    const lines = [
      { cat: 'drinks', qty: 2, unit: 650 },
      { cat: 'coolers', qty: 1, unit: 750 },
    ];
    // 08:30 AM = 510 mins (before 9*60 = 540)
    const earlyStamps = stampsFor(lines, 510, 0);
    // 3 drinks * 2 = 6 stamps
    expect(earlyStamps).toBe(6);
  });

  it('rolls over 10 stamps into a free drink reward', () => {
    let state = emptyClub();
    state.member = { name: 'Zainab', phone: '0300 1234567', birthday: '05-10', since: Date.now(), no: memberNumber(1) };
    state.stamps = 8;

    const res = addStamps(state, 4, { t: Date.now(), kind: 'order', order: 1001 });
    // 8 + 4 = 12 -> 1 reward earned, 2 stamps remaining
    expect(res.earned).toBe(1);
    expect(res.state.rewards).toBe(1);
    expect(res.state.stamps).toBe(2);
    expect(res.state.lifetime).toBe(4);
  });

  it('calculates reward value targeting the priciest drink up to Rs 1500 cap', () => {
    const lines = [
      { cat: 'drinks', qty: 1, unit: 550 },
      { cat: 'drinks', qty: 1, unit: 850 },
      { cat: 'kitchen', qty: 1, unit: 2200 },
    ];
    // Most expensive drink is 850
    expect(rewardValue(lines)).toBe(850);

    const expensiveLines = [
      { cat: 'drinks', qty: 1, unit: 2400 }, // Above Rs 1500 cap
    ];
    expect(rewardValue(expensiveLines)).toBe(CLUB.rewardCap);
  });

  it('spends reward correctly and records order history', () => {
    let state = emptyClub();
    state.rewards = 2;
    state.member = { name: 'Zainab', phone: '0300 1234567', birthday: '', since: Date.now(), no: memberNumber(1) };

    const next = spendReward(state, 1002, Date.now());
    expect(next.rewards).toBe(1);
    expect(next.history.some((h) => h.kind === 'redeem' && h.order === 1002)).toBe(true);
  });

  it('reverses order stamps and restores spent rewards on cancellation', () => {
    let state = emptyClub();
    state.rewards = 0;
    state.stamps = 2;
    state.credited = [1003];

    // Order 1003 earned 2 stamps and used 1 reward
    const reversed = reverseOrder(state, 1003, 2, true);
    // Rewards restored to 1, stamps remain 0
    expect(reversed.rewards).toBe(1);
    expect(reversed.stamps).toBe(0);
    expect(reversed.credited.includes(1003)).toBe(false);
  });

  it('identifies birthday week and gives birthday drink treat once per year', () => {
    let state = emptyClub();
    state.member = { name: 'Zainab', phone: '0300 1234567', birthday: '03-15', since: Date.now(), no: memberNumber(1) };

    const bdayDate = new Date(2026, 2, 15); // March 15, 2026
    expect(isBirthdayWeek('03-15', bdayDate)).toBe(true);

    const { state: treated, given } = birthdayTreat(state, bdayDate);
    expect(given).toBe(true);
    expect(treated.rewards).toBe(1);
    expect(treated.birthdayYear).toBe(2026);

    // Repeated call in the same year does not give another reward
    const secondCall = birthdayTreat(treated, bdayDate);
    expect(secondCall.given).toBe(false);
    expect(secondCall.state.rewards).toBe(1);
  });
});
