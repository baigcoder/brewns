/**
 * The house trio's book: a few original tunes and a player that performs them.
 *
 * Nothing here makes a sound. `perform` turns a tune into a list of bars, each
 * with the notes the piano, bass and drums play in it, the way a small jazz
 * trio would: an intro, the head (the written melody), a chorus or two of
 * improvising over the changes, the head again, and an ending that slows down.
 * lib/audio-ritual.ts plays the result through a sampled piano and synthesised
 * bass and drums.
 *
 * Times inside a bar are in beats (0 to 4). Swing is already applied: an
 * off-beat eighth sits late, by an amount that depends on the tempo.
 */

export type Feel = 'swing' | 'ballad' | 'bossa';
export type Inst = 'piano' | 'bass' | 'ride' | 'chick' | 'kick' | 'snare' | 'rim' | 'shaker' | 'swirl';
export interface Note {
  inst: Inst;
  /** Beats from the start of the bar. */
  t: number;
  /** Length in beats. */
  dur: number;
  /** MIDI note number, for the pitched instruments. */
  midi?: number;
  /** 0..1 */
  vel: number;
}
export interface Bar {
  notes: Note[];
  /** Tempo for this bar (the ending slows down). */
  bpm: number;
  part: 'intro' | 'head' | 'solo' | 'out' | 'end';
}
export interface Tune {
  title: string;
  bpm: number;
  feel: Feel;
  /** Section name → bars; a bar is one chord, or two chords of two beats each ("Dm7 G7"). */
  sections: Record<string, string[]>;
  form: string[];
  /** Choruses of improvising between the head and the head out. */
  solos: number;
}

/* ── the book ── */

export const BOOK: Tune[] = [
  {
    title: 'Gulberg Morning',
    bpm: 84,
    feel: 'ballad',
    sections: {
      A: ['Fmaj7', 'D7', 'Gm7', 'C7', 'Am7 D7', 'Gm7 C7', 'Fmaj7 Dm7', 'Gm7 C7'],
      B: ['Cm7', 'F7', 'Bbmaj7', 'Bbm6', 'Am7', 'D7', 'Gm7', 'C7'],
    },
    form: ['A', 'A', 'B', 'A'],
    solos: 0,
  },
  {
    title: 'Rain on Mall Road',
    bpm: 132,
    feel: 'bossa',
    sections: {
      A: ['Dm9', 'Dm9', 'Em7b5', 'A7', 'Dm7', 'G7', 'Cmaj7', 'Em7b5 A7'],
      B: ['Gm7', 'C7', 'Fmaj7', 'Bbmaj7', 'Em7b5', 'A7', 'Dm7', 'Em7b5 A7'],
    },
    form: ['A', 'A', 'B', 'A'],
    solos: 1,
  },
  {
    title: 'Second Pour',
    bpm: 138,
    feel: 'swing',
    sections: {
      A: ['Bbmaj7 G7', 'Cm7 F7', 'Dm7 G7', 'Cm7 F7', 'Fm7 Bb7', 'Ebmaj7 Ab7', 'Dm7 G7', 'Cm7 F7'],
      B: ['D7', 'D7', 'G7', 'G7', 'C7', 'C7', 'Cm7', 'F7'],
    },
    form: ['A', 'A', 'B', 'A'],
    solos: 1,
  },
  {
    title: 'Cardamom',
    bpm: 72,
    feel: 'ballad',
    sections: {
      A: ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Gm7 C7', 'Fm7 Bb7', 'Ebmaj7', 'Fm7 Bb7'],
      B: ['Abmaj7', 'Db7', 'Gm7', 'C7', 'Fm7', 'Bb7', 'Ebmaj7', 'Fm7 Bb7'],
    },
    form: ['A', 'A', 'B', 'A'],
    solos: 0,
  },
  {
    title: 'Last Order Blues',
    bpm: 120,
    feel: 'swing',
    sections: {
      A: ['Gm7', 'Cm7', 'Gm7', 'Gm7', 'Cm7', 'Cm7', 'Gm7', 'Gm7', 'Eb7', 'D7', 'Gm7', 'Am7b5 D7'],
    },
    form: ['A', 'A'],
    solos: 2,
  },
];

/* ── harmony ── */

type Quality = 'maj' | 'maj6' | 'min' | 'min6' | 'dom' | 'half' | 'sus';
interface ChordShape {
  tones: number[];
  scale: number[];
  /** Rootless voicings, two forms, as intervals above the root. */
  voicings: number[][];
}
const SHAPES: Record<Quality, ChordShape> = {
  maj: { tones: [0, 4, 7, 11], scale: [0, 2, 4, 7, 9, 11], voicings: [[4, 7, 11, 14], [11, 14, 16, 19]] },
  maj6: { tones: [0, 4, 7, 9], scale: [0, 2, 4, 7, 9, 11], voicings: [[4, 7, 9, 14], [9, 14, 16, 19]] },
  min: { tones: [0, 3, 7, 10], scale: [0, 2, 3, 5, 7, 9, 10], voicings: [[3, 7, 10, 14], [10, 14, 15, 19]] },
  min6: { tones: [0, 3, 7, 9], scale: [0, 2, 3, 5, 7, 9], voicings: [[3, 7, 9, 14], [9, 14, 15, 19]] },
  dom: { tones: [0, 4, 7, 10], scale: [0, 2, 4, 7, 9, 10], voicings: [[4, 9, 10, 14], [10, 14, 16, 21]] },
  half: { tones: [0, 3, 6, 10], scale: [0, 3, 5, 6, 8, 10], voicings: [[3, 6, 10, 12], [10, 12, 15, 18]] },
  sus: { tones: [0, 5, 7, 10], scale: [0, 2, 5, 7, 9, 10], voicings: [[5, 10, 14, 19], [10, 14, 17, 21]] },
};

export interface Chord {
  root: number;
  quality: Quality;
  shape: ChordShape;
  name: string;
}
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseChord(name: string): Chord {
  const m = /^([A-G])([b#]?)(.*)$/.exec(name);
  if (!m) throw new Error(`Not a chord: ${name}`);
  const root = (PC[m[1]] + (m[2] === 'b' ? 11 : m[2] === '#' ? 1 : 0)) % 12;
  const s = m[3];
  const quality: Quality = /^m7b5|ø/.test(s)
    ? 'half'
    : /^m6/.test(s)
      ? 'min6'
      : /^m(?!aj)/.test(s)
        ? 'min'
        : /^maj|^Δ/.test(s)
          ? 'maj'
          : /^6/.test(s)
            ? 'maj6'
            : /sus/.test(s)
              ? 'sus'
              : 'dom';
  return { root, quality, shape: SHAPES[quality], name };
}

/** The pitch in [lo, hi] with pitch class `pc` that is nearest to `near`. */
const place = (pc: number, near: number, lo: number, hi: number) => {
  let best = -1;
  for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc && (best < 0 || Math.abs(m - near) < Math.abs(best - near))) best = m;
  return best;
};

/** All the pitches in [lo, hi] whose pitch class is in `pcs` (relative to `root`). */
const ladder = (root: number, pcs: number[], lo: number, hi: number) => {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes((((m - root) % 12) + 12) % 12)) out.push(m);
  return out;
};

/* ── a seeded random source, so a tune can be replayed exactly in tests ── */

export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── the performance ── */

interface Slot {
  chords: { chord: Chord; at: number; beats: number }[];
  section: string;
  /** Bar number within its section. */
  n: number;
  /** Bars in its section. */
  len: number;
}

const expand = (tune: Tune): Slot[] =>
  tune.form.flatMap((name) =>
    tune.sections[name].map((bar, n, all) => {
      const names = bar.trim().split(/\s+/);
      const beats = 4 / names.length;
      return { chords: names.map((c, i) => ({ chord: parseChord(c), at: i * beats, beats })), section: name, n, len: all.length };
    }),
  );

/** How late the off-beat eighth falls, as a fraction of a beat. Slower tunes swing harder. */
export const swingFor = (tune: Tune) => (tune.feel === 'bossa' ? 0.5 : tune.bpm < 100 ? 0.66 : tune.bpm < 150 ? 0.62 : 0.58);

type Motif = { e: number; len: number; deg: number }[];

export function perform(tune: Tune, rng: () => number = Math.random): Bar[] {
  const R = (a: number, b: number) => a + rng() * (b - a);
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const sw = swingFor(tune);
  /** Eighth-note grid index (0..7 in a bar) to beats, with swing. */
  const eighth = (e: number) => Math.floor(e / 2) + (e % 2 ? sw : 0);
  const form = expand(tune);
  const bars: Bar[] = [];

  /* A motif is a short rhythm over two bars with a melodic shape, stored as positions on a ladder of chord tones so it
     can be laid over any chord and still fit it. Each section gets its own, and the head returns to it. */
  const makeMotif = (): Motif => {
    const onsets = new Set<number>([pick([0, 1, 2])]);
    const count = tune.feel === 'ballad' ? 3 + Math.floor(R(0, 3)) : 4 + Math.floor(R(0, 3));
    while (onsets.size < count) onsets.add(Math.floor(R(0, 13)));
    const es = [...onsets].sort((a, b) => a - b);
    let deg = Math.floor(R(3, 7));
    return es.map((e, i) => {
      if (i) deg = Math.max(0, Math.min(10, deg + pick([-2, -1, -1, 1, 1, 2, rng() < 0.15 ? 3 : -1])));
      const next = es[i + 1] ?? 16;
      return { e, len: Math.min(next - e, i === es.length - 1 ? 6 : 4), deg };
    });
  };
  const motifs: Record<string, Motif> = {};
  for (const name of new Set(tune.form)) motifs[name] = makeMotif();

  let voicing: number[] = [];
  let bass = 40;
  let line = 72;

  const comp = (notes: Note[], chord: Chord, at: number, beats: number, vel: number, part: Bar['part']) => {
    // Voice-lead: of the two rootless forms, in any octave, take the one closest to the last chord.
    let best: number[] = [];
    let cost = Infinity;
    for (const v of chord.shape.voicings)
      for (let oct = 3; oct <= 5; oct++) {
        const notesV = v.map((i) => oct * 12 + chord.root + i);
        if (notesV[0] < 50 || notesV[0] > 62) continue;
        const c = voicing.length ? notesV.reduce((s, m, i) => s + Math.abs(m - (voicing[i] ?? m)), 0) : Math.abs(notesV[0] - 56);
        if (c < cost) (cost = c), (best = notesV);
      }
    voicing = best;
    const hit = (t: number, d: number, v: number, roll = 0.012) =>
      best.forEach((m, i) => notes.push({ inst: 'piano', t: at + t + i * roll * R(0.6, 1.4), dur: d, midi: m, vel: v * R(0.88, 1.08) }));
    if (tune.feel === 'ballad' || part === 'end') {
      hit(0, beats * 0.95, vel * 1.1, 0.035);
      if (beats === 4 && rng() < 0.35 && part !== 'end') hit(2 + sw - 1, 1.2, vel * 0.7);
    } else if (tune.feel === 'bossa') {
      const pattern = pick([[0, 1.5, 2.5], [0.5, 2, 3.5], [0, 1.5, 3]]).filter((t) => t < beats);
      pattern.forEach((t) => hit(t, 0.45, vel, 0.006));
    } else {
      // Swing comping: the Charleston, a push on the and of two, or sparse hits on two and four.
      const pattern = beats === 2 ? pick([[0], [sw]]) : pick([[0, 1 + sw], [1, 3], [sw, 2 + sw], [0, 2]]);
      pattern.filter((t) => t < beats).forEach((t) => hit(t, 0.55, vel * R(0.9, 1.1), 0.008));
    }
  };

  const walk = (notes: Note[], chord: Chord, at: number, beats: number, nextRoot: number, vel: number) => {
    const root = place(chord.root, bass, 31, 50);
    const target = place(nextRoot, root, 31, 50);
    if (tune.feel === 'ballad') {
      notes.push({ inst: 'bass', t: at, dur: beats >= 4 ? 1.9 : beats * 0.95, midi: root, vel });
      if (beats >= 4) notes.push({ inst: 'bass', t: at + 2, dur: 1.9, midi: rng() < 0.6 ? place((chord.root + 7) % 12, root, 31, 52) : target + (target > root ? -1 : 1), vel: vel * 0.9 });
    } else if (tune.feel === 'bossa') {
      const fifth = place((chord.root + 7) % 12, root - 3, 28, 50);
      notes.push({ inst: 'bass', t: at, dur: 1.4, midi: root, vel });
      if (beats >= 4) {
        notes.push({ inst: 'bass', t: at + 1.5, dur: 0.45, midi: fifth, vel: vel * 0.7 });
        notes.push({ inst: 'bass', t: at + 2, dur: 1.4, midi: fifth, vel: vel * 0.9 });
      } else notes.push({ inst: 'bass', t: at + 1.5, dur: 0.45, midi: fifth, vel: vel * 0.7 });
    } else {
      // Walking: the root on one, chord and scale tones towards the next root, a chromatic step into it on the last beat.
      const steps = Math.round(beats);
      const approach = rng() < 0.7 ? target + (target >= root ? -1 : 1) : place((nextRoot + 7) % 12, target, 31, 52);
      const pool = ladder(chord.root, rng() < 0.6 ? chord.shape.tones : chord.shape.scale, 31, 52);
      const seq = [root];
      for (let s = 1; s < steps - 1; s++) {
        const prev = seq[s - 1];
        const dir = approach >= prev ? 1 : -1;
        const cands = pool.filter((m) => m !== prev && (m - prev) * dir > 0 && Math.abs(m - prev) <= 5);
        seq.push(cands.length ? cands[Math.floor(rng() * Math.min(2, cands.length))] : prev + dir * 2);
      }
      if (steps > 1) seq.push(approach);
      seq.forEach((m, s) => notes.push({ inst: 'bass', t: at + s, dur: 0.92, midi: m, vel: vel * (s % 2 ? 0.86 : 1) }));
    }
    bass = root;
  };

  const drums = (notes: Note[], part: Bar['part'], slot: Slot, vel: number) => {
    const end = slot.n === slot.len - 1;
    if (tune.feel === 'ballad') {
      notes.push({ inst: 'swirl', t: 0, dur: 4, vel: 0.5 * vel });
      notes.push({ inst: 'snare', t: 1, dur: 0.3, vel: 0.5 * vel }, { inst: 'snare', t: 3, dur: 0.3, vel: 0.58 * vel });
      notes.push({ inst: 'kick', t: 0, dur: 0.5, vel: 0.2 * vel });
    } else if (tune.feel === 'bossa') {
      // The cross-stick pattern runs over two bars.
      const rim = bars.length % 2 ? [1, 2.5] : [0, 1.5, 3];
      rim.forEach((t) => notes.push({ inst: 'rim', t, dur: 0.1, vel: 0.5 * vel }));
      for (let e = 0; e < 8; e++) notes.push({ inst: 'shaker', t: e / 2, dur: 0.25, vel: (e % 2 ? 0.28 : 0.45) * vel });
      [0, 1.5, 2, 3.5].forEach((t, i) => notes.push({ inst: 'kick', t, dur: 0.4, vel: (i % 2 ? 0.2 : 0.32) * vel }));
    } else {
      // Ride: ding, ding-da, ding, ding-da; the hi-hat foot on two and four; the bass drum feathered.
      [0, 1, 1 + sw, 2, 3, 3 + sw].forEach((t, i) => notes.push({ inst: 'ride', t, dur: 1, vel: [0.7, 0.85, 0.5, 0.7, 0.85, 0.5][i] * vel * R(0.9, 1.05) }));
      notes.push({ inst: 'chick', t: 1, dur: 0.2, vel: 0.55 * vel }, { inst: 'chick', t: 3, dur: 0.2, vel: 0.55 * vel });
      for (let b = 0; b < 4; b++) notes.push({ inst: 'kick', t: b, dur: 0.3, vel: 0.12 * vel });
      if (part === 'solo' && rng() < 0.35) notes.push({ inst: 'snare', t: pick([1 + sw, 2 + sw, 3 + sw]), dur: 0.2, vel: 0.25 * vel });
      // A fill into each new section.
      if (end) [3, 3 + sw, 3 + sw + (1 - sw) * 0.5].forEach((t, i) => notes.push({ inst: 'snare', t, dur: 0.15, vel: (0.3 + i * 0.1) * vel }));
    }
  };

  const melody = (notes: Note[], slot: Slot, chords: Slot['chords'], part: Bar['part'], vel: number) => {
    const chordAt = (t: number) => [...chords].reverse().find((c) => c.at <= t)!.chord;
    const lo = 65, hi = 86;
    if (part === 'head' || part === 'out') {
      // The written melody: the section's motif, answered, moved up, and brought home.
      const motif = motifs[slot.section];
      const phrase = Math.floor(slot.n / 2) % 4;
      const half = slot.n % 2;
      const lastPhrase = slot.n >= slot.len - 2;
      const lift = phrase === 2 ? 2 : phrase === 1 ? (slot.len > 8 ? 0 : 1) : 0;
      motif
        .filter((m) => (half ? m.e >= 8 : m.e < 8))
        .forEach((m, i, arr) => {
          const t = eighth(m.e - half * 8);
          const c = chordAt(t);
          const rungs = ladder(c.root, [...c.shape.tones, 2], lo, hi);
          let deg = m.deg + lift;
          // The last phrase of a section comes down to rest on the root or the third.
          const cadence = lastPhrase && half === 1 && i === arr.length - 1;
          let midi = rungs[Math.max(0, Math.min(rungs.length - 1, deg))];
          if (cadence) midi = place(pick([c.root, (c.root + c.shape.tones[1]) % 12]), midi, lo, hi);
          const dur = cadence ? Math.max(1.5, 4 - t) : Math.max(0.3, (m.len / 2) * 0.95);
          notes.push({ inst: 'piano', t, dur, midi, vel: vel * R(0.95, 1.1) });
          line = midi;
        });
    } else if (part === 'solo') {
      // Improvising: runs of eighths through the chord's scale, landing on chord tones on the beat, in phrases with room
      // to breathe between them.
      const resting = slot.n % 4 === 3 || rng() < 0.15;
      if (resting) return;
      let dir = rng() < 0.5 ? 1 : -1;
      const start = pick([0, 1, 2]);
      const count = Math.floor(R(4, 8));
      for (let e = start; e < Math.min(8, start + count); e++) {
        const t = eighth(e);
        const c = chordAt(t);
        const rungs = ladder(c.root, e % 2 ? c.shape.scale : c.shape.tones, lo, hi - 4);
        let i = rungs.findIndex((m) => m >= line);
        if (i < 0) i = rungs.length - 1;
        i = Math.max(0, Math.min(rungs.length - 1, i + dir));
        if (i === 0 || i === rungs.length - 1 || rng() < 0.15) dir = -dir;
        line = rungs[i];
        notes.push({ inst: 'piano', t, dur: e % 2 ? 0.4 : 0.55, midi: line, vel: vel * (e % 2 ? 0.8 : 1) * R(0.9, 1.1) });
      }
    }
  };

  const play = (slot: Slot, part: Bar['part'], nextRoot: number, bpm = tune.bpm) => {
    const notes: Note[] = [];
    const level = part === 'solo' ? 1.05 : slot.section === 'B' ? 1 : 0.92;
    slot.chords.forEach(({ chord, at, beats }, i) => {
      comp(notes, chord, at, beats, (part === 'solo' ? 0.26 : 0.22) * level, part);
      walk(notes, chord, at, beats, slot.chords[i + 1]?.chord.root ?? nextRoot, 0.8 * level);
    });
    if (part !== 'intro' && part !== 'end') melody(notes, slot, slot.chords, part, 0.4 * level);
    if (part !== 'end') drums(notes, part, slot, level);
    bars.push({ notes, bpm, part });
  };

  // Intro: the last two bars of the form as a turnaround, no melody.
  const turn = form.slice(-2);
  turn.forEach((s, i) => play(s, 'intro', (turn[i + 1] ?? form[0]).chords[0].chord.root));
  const passes: Bar['part'][] = ['head', ...Array(tune.solos).fill('solo'), 'out'];
  passes.forEach((part, p) =>
    form.forEach((s, i) => {
      const last = p === passes.length - 1 && i === form.length - 1;
      const next = form[(i + 1) % form.length].chords[0].chord.root;
      // The last two bars of the tune slow down into the ending.
      const bpm = p === passes.length - 1 && i >= form.length - 2 ? tune.bpm * (i === form.length - 1 ? 0.84 : 0.93) : tune.bpm;
      play(s, part, last ? form[0].chords[0].chord.root : next, bpm);
    }),
  );
  // The ending: the home chord, held.
  const home = form[0].chords[0].chord;
  const endSlot: Slot = { chords: [{ chord: home, at: 0, beats: 4 }], section: 'A', n: 0, len: 1 };
  play(endSlot, 'end', home.root, tune.bpm * 0.7);
  const end = bars[bars.length - 1];
  end.notes.push({ inst: 'piano', t: 0.1, dur: 5, midi: place(home.root, 79, 72, 86), vel: 0.34 });
  end.notes.forEach((n) => (n.dur = Math.max(n.dur, 5)));
  end.notes.push({ inst: 'ride', t: 0, dur: 4, vel: 0.35 });
  return bars;
}

/** Seconds a performance lasts. */
export const performanceSeconds = (bars: Bar[]) => bars.reduce((s, b) => s + (4 * 60) / b.bpm, 0);

/** The order for a set: starts with something that suits the hour in Lahore (ballads and bossa in the morning, swing
 *  later), then the rest, shuffled. */
export function setList(hour: number, rng: () => number = Math.random): number[] {
  const order = BOOK.map((_, i) => i).sort(() => rng() - 0.5);
  const morning = hour >= 6 && hour < 12;
  const first = order.findIndex((i) => (morning ? BOOK[i].feel !== 'swing' : BOOK[i].feel === 'swing'));
  if (first > 0) order.unshift(...order.splice(first, 1));
  return order;
}

export const FEEL_NAMES: Record<Feel, string> = { swing: 'medium swing', ballad: 'ballad', bossa: 'bossa nova' };
