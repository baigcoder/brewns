/* brewns Club: the loyalty card.

   One stamp for every drink on an order (coffee, tea, coolers), two before
   09:00. Ten stamps make a free drink, taken off the priciest drink in the bag at
   checkout. Members who give a birthday get a free drink in their birthday week,
   once a year. The card lives in the browser (localStorage) until there is a
   backend; everything here is pure so it can move to one unchanged. */

export const CLUB = {
  stampsPerReward: 10,
  welcomeStamps: 1,
  // Orders placed before this minute of the day earn double stamps.
  earlyUntilMin: 9 * 60,
  // A free drink is worth up to this much; anything above is paid as usual.
  rewardCap: 1500,
  // Product categories whose items earn a stamp and can be the free drink.
  drinkCats: ['drinks', 'coolers'] as readonly string[],
  // How long after an order a new member can still claim its stamps.
  claimWindowMs: 24 * 60 * 60 * 1000,
} as const;

export type ClubEvent = { t: number; kind: 'join' | 'order' | 'redeem' | 'birthday'; n: number; order?: number };

export type ClubMember = { name: string; phone: string; birthday: string; since: number; no: string };

export type ClubState = {
  member: ClubMember | null;
  /** Stamps towards the next reward (0 … stampsPerReward - 1). */
  stamps: number;
  /** Free drinks earned and not yet used. */
  rewards: number;
  /** Every stamp ever earned, for the card's "since" line. */
  lifetime: number;
  /** The year a birthday drink was last given, so it comes once a year. */
  birthdayYear: number;
  /** Order numbers that have already earned stamps. */
  credited: number[];
  history: ClubEvent[];
};

export const emptyClub = (): ClubState => ({ member: null, stamps: 0, rewards: 0, lifetime: 0, birthdayYear: 0, credited: [], history: [] });

/** Reads a stored card, filling in anything an older version didn't save. */
export const normaliseClub = (raw: unknown): ClubState => {
  const base = emptyClub();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...(raw as Partial<ClubState>) };
  return {
    ...s,
    stamps: Math.max(0, Math.min(CLUB.stampsPerReward - 1, Math.floor(Number(s.stamps) || 0))),
    rewards: Math.max(0, Math.floor(Number(s.rewards) || 0)),
    lifetime: Math.max(0, Math.floor(Number(s.lifetime) || 0)),
    credited: Array.isArray(s.credited) ? s.credited.slice(0, 50) : [],
    history: Array.isArray(s.history) ? s.history.slice(0, 30) : [],
  };
};

/** A member number that reads like one on a card: BRW 4821 0937. */
export const memberNumber = (seed: number) => {
  const n = String(Math.abs(Math.imul(seed | 0, 2654435761) >>> 0)).padStart(8, '0').slice(-8);
  return `BRW ${n.slice(0, 4)} ${n.slice(4)}`;
};

type Line = { cat: string; qty: number; unit: number };

export const isDrink = (cat: string) => CLUB.drinkCats.includes(cat);

/** Stamps an order earns: one per drink, doubled before 09:00. A drink taken as a reward earns none. */
export const stampsFor = (lines: Line[], placedMinOfDay: number, freeDrinks = 0) => {
  const drinks = lines.filter((l) => isDrink(l.cat)).reduce((n, l) => n + l.qty, 0);
  return Math.max(0, drinks - freeDrinks) * (placedMinOfDay < CLUB.earlyUntilMin ? 2 : 1);
};

/** What a free drink takes off this bag: the priciest single drink, up to the cap. */
export const rewardValue = (lines: Line[]) =>
  Math.min(CLUB.rewardCap, lines.filter((l) => isDrink(l.cat) && l.qty > 0).reduce((max, l) => Math.max(max, l.unit), 0));

/** Adds stamps, turning every full card into a reward. Returns the new state and how many rewards it made. */
export const addStamps = (s: ClubState, n: number, event: Omit<ClubEvent, 'n'>): { state: ClubState; earned: number } => {
  const credited = event.order ? [event.order, ...s.credited.filter((o) => o !== event.order)].slice(0, 50) : s.credited;
  if (n <= 0) return { state: { ...s, credited }, earned: 0 };
  const total = s.stamps + n;
  const earned = Math.floor(total / CLUB.stampsPerReward);
  return {
    state: {
      ...s,
      stamps: total % CLUB.stampsPerReward,
      rewards: s.rewards + earned,
      lifetime: s.lifetime + n,
      credited,
      history: [{ ...event, n }, ...s.history].slice(0, 30),
    },
    earned,
  };
};

export const spendReward = (s: ClubState, order: number, t: number): ClubState =>
  s.rewards > 0 ? { ...s, rewards: s.rewards - 1, history: [{ t, kind: 'redeem' as const, n: 1, order }, ...s.history].slice(0, 30) } : s;

/** Takes back what a cancelled order earned, and returns the free drink it used. */
export const reverseOrder = (s: ClubState, order: number, stamps: number, rewardUsed: boolean): ClubState => {
  if (!s.credited.includes(order)) return s;
  const units = Math.max(0, s.rewards * CLUB.stampsPerReward + s.stamps - stamps + (rewardUsed ? CLUB.stampsPerReward : 0));
  return {
    ...s,
    rewards: Math.floor(units / CLUB.stampsPerReward),
    stamps: units % CLUB.stampsPerReward,
    lifetime: Math.max(0, s.lifetime - stamps),
    credited: s.credited.filter((n) => n !== order),
    history: s.history.filter((h) => h.order !== order),
  };
};

/** Birthdays are stored as MM-DD. It is birthday week from three days before to three after. */
export const isBirthdayWeek = (birthday: string, now = new Date()) => {
  const m = /^(\d{2})-(\d{2})$/.exec(birthday || '');
  if (!m) return false;
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const day = new Date(year, +m[1] - 1, +m[2]);
    if (Math.abs(day.getTime() - now.getTime()) <= 3.5 * 86400000) return true;
  }
  return false;
};

/** Gives the once-a-year birthday drink if it is due. */
export const birthdayTreat = (s: ClubState, now = new Date()): { state: ClubState; given: boolean } => {
  if (!s.member || !isBirthdayWeek(s.member.birthday, now) || s.birthdayYear === now.getFullYear()) return { state: s, given: false };
  return {
    state: { ...s, rewards: s.rewards + 1, birthdayYear: now.getFullYear(), history: [{ t: now.getTime(), kind: 'birthday' as const, n: 1 }, ...s.history].slice(0, 30) },
    given: true,
  };
};
