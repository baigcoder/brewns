import { describe, expect, it } from 'bun:test';
import { BOOK, parseChord, perform, performanceSeconds, seeded, setList } from '@/lib/jazzScore';

describe('the trio book', () => {
  it('reads chord symbols', () => {
    expect(parseChord('Bbmaj7')).toMatchObject({ root: 10, quality: 'maj' });
    expect(parseChord('Em7b5')).toMatchObject({ root: 4, quality: 'half' });
    expect(parseChord('Dm9')).toMatchObject({ root: 2, quality: 'min' });
    expect(parseChord('Bbm6')).toMatchObject({ root: 10, quality: 'min6' });
    expect(parseChord('Ab7')).toMatchObject({ root: 8, quality: 'dom' });
  });

  for (const tune of BOOK)
    describe(tune.title, () => {
      const bars = perform(tune, seeded(tune.title.length));

      it('plays a full tune of sensible length, ending slower', () => {
        const secs = performanceSeconds(bars);
        expect(secs).toBeGreaterThan(90);
        expect(secs).toBeLessThan(360);
        expect(bars.at(-1)!.part).toBe('end');
        expect(bars.at(-1)!.bpm).toBeLessThan(tune.bpm);
      });

      it('keeps every note in the bar, in range, with a real pitch and level', () => {
        for (const bar of bars)
          for (const n of bar.notes) {
            expect(n.t).toBeGreaterThanOrEqual(0);
            expect(n.t).toBeLessThan(4.2);
            expect(n.vel).toBeGreaterThan(0);
            expect(n.vel).toBeLessThanOrEqual(1);
            if (n.inst === 'bass') expect(n.midi!).toBeGreaterThanOrEqual(28), expect(n.midi!).toBeLessThanOrEqual(52);
            if (n.inst === 'piano') expect(n.midi!).toBeGreaterThanOrEqual(45), expect(n.midi!).toBeLessThanOrEqual(88);
            if (n.midi !== undefined) expect(Number.isInteger(n.midi)).toBe(true);
          }
      });

      it('puts the bass on the root of the chord on the downbeat', () => {
        const form = tune.form.flatMap((s) => tune.sections[s]);
        const played = bars.filter((b) => b.part === 'head');
        played.forEach((bar, i) => {
          const root = parseChord(form[i].split(/\s+/)[0]).root;
          const first = bar.notes.find((n) => n.inst === 'bass' && n.t === 0)!;
          expect(((first.midi! % 12) + 12) % 12).toBe(root);
        });
      });

      it('has a melody in the head and none in the intro', () => {
        const melodyNotes = (part: string) => bars.filter((b) => b.part === part).flatMap((b) => b.notes.filter((n) => n.inst === 'piano' && n.midi! >= 65));
        expect(melodyNotes('head').length).toBeGreaterThan(tune.form.length * 6);
        expect(bars.filter((b) => b.part === 'intro').length).toBe(2);
      });
    });

  it('opens the morning set with something gentle and the evening with swing', () => {
    for (let s = 1; s < 20; s++) {
      expect(BOOK[setList(8, seeded(s))[0]].feel).not.toBe('swing');
      expect(BOOK[setList(20, seeded(s))[0]].feel).toBe('swing');
      expect(new Set(setList(20, seeded(s))).size).toBe(BOOK.length);
    }
  });
});
