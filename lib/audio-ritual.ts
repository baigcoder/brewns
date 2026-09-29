/**
 * brewns sound: a living café under the page, plus small tactile sounds for
 * what you touch. The café is synthesised with the Web Audio API, modelled on
 * how each thing really makes its sound; the music plays recordings of a real
 * piano (public/assets/sound/piano/). All of it runs through one master bus so the volume and
 * switches in the sound panel apply everywhere.
 *
 * Layers
 *   room     the room tone and the fridge, people talking in turns at five
 *            tables, chairs, spoons and cups, the door with the road outside
 *   bar      every drink made start to finish: ticket, knock, grind, tamp,
 *            the pump and the shot, milk steamed, ice, the counter bell
 *   music    the house trio (sampled grand piano, upright bass, brushes and
 *            ride) playing a set of original tunes from lib/jazzScore.ts
 *   ui       clicks, pours, the printer, message pops, chimes
 *
 * Everything in the room has a place (the bar ahead to the left, the door
 * behind to the right), so with headphones it sits around you. How busy it is
 * follows the time in Lahore.
 *
 * A real recording, if one is placed at public/assets/sound/cafe.mp3, replaces
 * the synthesised room and bar automatically.
 *
 * Nothing plays until the visitor turns sound on (browsers require a click),
 * and it fades out when the tab is hidden.
 */

import { BOOK, FEEL_NAMES, perform, setList, type Bar } from './jazzScore';

type Settings = { on: boolean; volume: number; ambience: boolean; music: boolean; ui: boolean };
const KEY = 'brewns-sound';
const DEFAULTS: Settings = { on: false, volume: 0.7, ambience: true, music: true, ui: true };

let settings: Settings = { ...DEFAULTS };
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let uiBus: GainNode | null = null;
let roomBus: GainNode | null = null;
let barBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let started = false;
let scene = { room: 1, bar: 1, music: 1 };
// The layers reschedule themselves forever; their timer ids aren't needed, and
// keeping them all grew an array by thousands an hour.
const timers = { push: (id: number) => id };
const listeners = new Set<(s: Settings) => void>();

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ── settings ── */

export function initAudioState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) settings = { ...DEFAULTS, ...saved };
    else settings.on = localStorage.getItem('brewns-audio-enabled') === 'true';
  } catch {}
  // Browsers only allow audio after a gesture: resume on the first one. On
  // phones a finger going down doesn't count, a tap (finger up) does.
  if (settings.on) {
    const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
    const wake = () => {
      start();
      if (ctx?.state === 'running') GESTURES.forEach((g) => window.removeEventListener(g, wake, true));
    };
    GESTURES.forEach((g) => window.addEventListener(g, wake, true));
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !master) return;
    apply();
  });
  return settings.on;
}

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
  listeners.forEach((f) => f({ ...settings }));
};

export const getSoundSettings = (): Settings => ({ ...settings });
export const onSoundChange = (f: (s: Settings) => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
export const getIsAudioEnabled = () => settings.on;

export function setSound(patch: Partial<Settings>) {
  settings = { ...settings, ...patch, volume: clamp(patch.volume ?? settings.volume) };
  if (settings.on) start();
  apply();
  save();
}

export function toggleAudioState(): boolean {
  setSound({ on: !settings.on });
  if (settings.on) playChime();
  return settings.on;
}

/* ── the graph ── */

function fade(p: AudioParam, to: number, secs = 1.2) {
  if (!ctx) return;
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(to, now + secs);
}

let sleepTimer = 0;
function apply() {
  if (!ctx || !master || !roomBus || !barBus || !musicBus || !uiBus) return;
  const audible = settings.on && !document.hidden;
  // Off or in a background tab, the whole graph sleeps after fading out: no
  // CPU, no battery, and nothing piles up to play at once on return.
  window.clearTimeout(sleepTimer);
  if (audible) {
    if (ctx.state === 'suspended') ctx.resume();
    iosSession(true);
  } else
    sleepTimer = window.setTimeout(() => {
      if (!settings.on || document.hidden) {
        ctx?.suspend();
        iosSession(false);
      }
    }, 700);
  // volume is a loudness control: the square makes the low half of the slider useful
  fade(master.gain, audible ? settings.volume * settings.volume * 1.4 + 0.02 : 0, audible ? 1.5 : 0.5);
  fade(roomBus.gain, settings.ambience ? 0.9 * scene.room : 0, 1.8);
  fade(barBus.gain, settings.ambience ? 0.8 * scene.bar : 0, 1.8);
  fade(musicBus.gain, settings.music ? 0.42 * scene.music : 0, 2.2);
  fade(uiBus.gain, settings.ui ? 1 : 0, 0.2);
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0;
    // make-up gain into a gentle compressor, then a limiter so nothing clips:
    // the mix sits around -20 dBFS, loud enough for laptop and phone speakers
    const makeup = ctx.createGain();
    makeup.gain.value = 2.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    master.connect(makeup).connect(comp).connect(limiter).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx, 1.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
    const bus = (toReverb = 0) => {
      const g = ctx!.createGain();
      g.gain.value = 0;
      g.connect(master!);
      if (toReverb) {
        const send = ctx!.createGain();
        send.gain.value = toReverb;
        g.connect(send).connect(reverb!);
      }
      return g;
    };
    roomBus = bus(0.6);
    barBus = bus(0.8);
    musicBus = bus(0.25);
    uiBus = bus(0.15);
    uiBus.gain.value = 1;
  }
  if (ctx.state === 'suspended' && settings.on && !document.hidden) ctx.resume();
  return ctx;
}

/** Scheduled layers only add events while the graph is running and audible. */
const live = () => !!ctx && ctx.state === 'running' && settings.on;

/* iPhones mute Web Audio with the silent switch on, unless a media element is
   playing: a looping, silent <audio> puts the page in the "playback" session so
   the café is heard like music. iOS only; elsewhere it isn't needed. */
let iosKeepAlive: HTMLAudioElement | null = null;
const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));
function iosSession(on: boolean) {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && on) {
    try {
      session.type = 'playback';
    } catch {}
  }
  if (!isIOS()) return;
  if (on) {
    if (!iosKeepAlive) {
      // 0.25 s of 8 kHz silence as a WAV
      const n = 2000;
      const bytes = new Uint8Array(44 + n);
      const v = new DataView(bytes.buffer);
      const str = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
      str(0, 'RIFF');
      v.setUint32(4, 36 + n, true);
      str(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true);
      v.setUint32(28, 8000, true);
      v.setUint16(32, 1, true);
      v.setUint16(34, 8, true);
      str(36, 'data');
      v.setUint32(40, n, true);
      bytes.fill(128, 44);
      iosKeepAlive = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
      iosKeepAlive.loop = true;
      iosKeepAlive.setAttribute('playsinline', '');
    }
    iosKeepAlive.play().catch(() => {});
  } else iosKeepAlive?.pause();
}

/** The reverb of a small room with soft furnishing: a few early reflections off
 *  the walls and the bar, then a tail that loses its top end as it dies, the
 *  way sofas and people soak up the highs. */
function roomImpulse(c: AudioContext, secs: number) {
  const len = Math.floor(c.sampleRate * secs);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len;
      // the tail darkens: a one-pole lowpass whose cutoff falls with time
      const k = 0.55 - 0.45 * p;
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - p, 2.6) * 1.6;
    }
    // early reflections: walls, the bar top, the window
    [0.007, 0.013, 0.019, 0.027, 0.041].forEach((t, k) => {
      const at = Math.floor((t + ch * 0.0013 * (k + 1)) * c.sampleRate);
      if (at < len) d[at] += (k % 2 ? -1 : 1) * (0.7 - k * 0.11);
    });
  }
  return buf;
}

function noiseBuffer(c: AudioContext, secs: number, colour: 'white' | 'pink' | 'brown' = 'white') {
  const len = Math.floor(c.sampleRate * secs);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (colour === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (colour === 'pink') {
      b0 = 0.997 * b0 + 0.029591 * w;
      b1 = 0.985 * b1 + 0.032534 * w;
      b2 = 0.95 * b2 + 0.048056 * w;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 0.8;
    } else d[i] = w;
  }
  return buf;
}

function start() {
  const c = ensure();
  if (!c || started) {
    apply();
    return;
  }
  started = true;
  tryRecording().then((real) => {
    if (!real) {
      startRoom();
      startBar();
    }
    startMusic();
    apply();
  });
}

/* ── a real recording, if one has been added ── */
// The server says whether the file exists; unknown (null) means ask it.
let recordingAvailable: boolean | null = null;
export function setCafeRecording(available: boolean) {
  recordingAvailable = available;
}
async function tryRecording() {
  if (recordingAvailable === false) return false;
  try {
    const res = await fetch('/assets/sound/cafe.mp3', { method: 'HEAD' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('audio')) return false;
    const el = new Audio('/assets/sound/cafe.mp3');
    el.loop = true;
    el.crossOrigin = 'anonymous';
    ctx!.createMediaElementSource(el).connect(roomBus!);
    await el.play();
    return true;
  } catch {
    return false;
  }
}

/* ── shared pieces for the café ── */

// One buffer of each noise, shared by every sound that needs one.
let noises: Record<'white' | 'pink' | 'brown', AudioBuffer> | null = null;
const nb = () => (noises ||= { white: noiseBuffer(ctx!, 2), pink: noiseBuffer(ctx!, 4, 'pink'), brown: noiseBuffer(ctx!, 6, 'brown') });
/** A stretch of noise, from a random point in the shared buffer, into `out`
 *  (returned, so a chain can carry on from it). */
function noise<T extends AudioNode>(colour: 'white' | 'pink' | 'brown', at: number, dur: number, out: T): T {
  const s = ctx!.createBufferSource();
  s.buffer = nb()[colour];
  s.loop = true;
  s.connect(out);
  s.start(at, rand(0, s.buffer.duration - 0.05));
  if (Number.isFinite(dur)) s.stop(at + dur);
  return out;
}
function filter(type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
function gainNode(v = 0) {
  const g = ctx!.createGain();
  g.gain.value = v;
  return g;
}
const later = (f: () => void, ms: number) => timers.push(window.setTimeout(f, ms));

/* Where things are. The listener sits at a table in the middle of the room,
   facing the bar; with headphones the grinder is ahead to the left, the door
   behind to the right, and the tables all around. Phones get simple stereo. */
type Spot = { x: number; z: number };
const SPOTS = {
  bar: { x: -2.4, z: -2.6 },
  grinder: { x: -3.2, z: -2.9 },
  till: { x: -0.9, z: -3.3 },
  door: { x: 3.9, z: 1.8 },
  street: { x: 7, z: 4 },
  fridge: { x: -4.2, z: -1.4 },
};
const TABLES: Spot[] = [
  { x: -1.6, z: 1.3 },
  { x: 1.9, z: -1.4 },
  { x: 2.8, z: 2.4 },
  { x: -3.4, z: 0.4 },
  { x: 0.5, z: 3.6 },
];
const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
function setPos(p: PannerNode, x: number, z: number) {
  if (p.positionX) {
    p.positionX.value = x;
    p.positionY.value = 0;
    p.positionZ.value = z;
  } else p.setPosition(x, 0, z);
}
function placed(out: AudioNode, spot: Spot, spread = 0) {
  const p = ctx!.createPanner();
  p.panningModel = coarse() ? 'equalpower' : 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 1.5;
  p.rolloffFactor = 0.8;
  setPos(p, spot.x + rand(-spread, spread), spot.z + rand(-spread, spread));
  p.connect(out);
  return p;
}

/* How busy the café is, from the clock in Lahore (UTC+5): the morning rush,
   the lunch crowd, the evening, and a quiet room after closing. */
const pkHour = () => (Date.now() / 3600000 + 5) % 24;
function busy() {
  const h = pkHour();
  if (h < 7 || h >= 21) return 0.3;
  if (h < 9.5) return 1;
  if (h >= 12 && h < 14) return 0.95;
  if (h >= 18) return 0.85;
  return 0.65;
}

/* What's happening, for the sound panel to show. */
const momentListeners = new Set<(text: string) => void>();
export const onCafeMoment = (f: (text: string) => void) => {
  momentListeners.add(f);
  return () => momentListeners.delete(f);
};
const moment = (text: string) => settings.ambience && momentListeners.forEach((f) => f(text));
export const SOUND_CREDITS = 'Piano: Salamander Grand Piano by Alexander Holm, CC BY 3.0';

/* ── resonant things: cups, spoons, the milk jug, bells ──
   A struck object rings at a handful of frequencies that aren't whole
   multiples of each other, each dying away at its own rate; the high ones go
   first. That, plus the click of the contact, is what makes it ceramic or
   steel rather than a synth. */
type Mode = [ratio: number, amp: number, decay: number];
const CERAMIC: Mode[] = [[1, 1, 0.3], [2.32, 0.55, 0.19], [4.25, 0.32, 0.11], [6.63, 0.18, 0.07], [9.38, 0.1, 0.04]];
const STEEL: Mode[] = [[1, 1, 0.9], [2.76, 0.5, 0.5], [5.4, 0.28, 0.3], [8.93, 0.14, 0.18]];
const BELL: Mode[] = [[1, 1, 1.6], [2.02, 0.6, 1.1], [3.01, 0.35, 0.7], [4.16, 0.22, 0.45], [5.43, 0.14, 0.3]];
function strike(modes: Mode[], base: number, at: number, level: number, out: AudioNode, click = 0.5) {
  const c = ctx!;
  const g = gainNode(level);
  g.connect(out);
  modes.forEach(([ratio, amp, decay]) => {
    const o = c.createOscillator();
    o.frequency.value = base * ratio * rand(0.994, 1.006);
    const a = c.createGain();
    const d = decay * rand(0.8, 1.25);
    a.gain.setValueAtTime(amp, at);
    a.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(a).connect(g);
    o.start(at);
    o.stop(at + d + 0.02);
  });
  if (click) {
    const hp = filter('highpass', 2500);
    const cg = gainNode(0);
    cg.gain.setValueAtTime(click, at);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
    noise('white', at, 0.02, hp);
    hp.connect(cg).connect(g);
  }
}
const cup = (at: number, out: AudioNode, level = 0.05, pitch = 1) => strike(CERAMIC, 1150 * pitch * rand(0.9, 1.12), at, level, out, 0.6);
const spoonTick = (at: number, out: AudioNode, level = 0.012) => strike(STEEL, 3300 * rand(0.95, 1.05), at, level, out, 0.2);

/** A soft, low knock: wood, the knock box, a door swinging shut. */
function thud(at: number, out: AudioNode, level: number, from = 120, to = 50, len = 0.14) {
  const c = ctx!;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + len);
  const g = gainNode(0);
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.04);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.06);
  const lp = filter('lowpass', 700);
  const ng = gainNode(0);
  ng.gain.setValueAtTime(level * 0.6, at);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  noise('white', at, 0.04, lp);
  lp.connect(ng).connect(out);
}

/* ── room: the hum of the place, and people talking ── */
function startRoom() {
  const c = ctx!;
  // air conditioning and the room itself
  noise('brown', c.currentTime, Infinity, filter('lowpass', 320)).connect(gainNode(0.06)).connect(roomBus!);

  // The fridge under the bar: a 50 Hz hum that clicks on, runs, and stops.
  const fridge = placed(roomBus!, SPOTS.fridge);
  const hum = gainNode(0);
  [50, 100, 150].forEach((f, i) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const a = gainNode([0.02, 0.012, 0.004][i]);
    o.connect(a).connect(hum);
    o.start();
  });
  hum.connect(filter('lowpass', 240)).connect(fridge);
  const cycle = (on: boolean) => {
    if (live()) {
      const t = c.currentTime;
      thud(t, fridge, 0.03, 90, 60, 0.05);
      hum.gain.setTargetAtTime(on ? 1 : 0, t + 0.05, on ? 0.4 : 0.8);
    }
    later(() => cycle(!on), on ? rand(40000, 90000) : rand(30000, 70000));
  };
  later(() => cycle(true), rand(3000, 12000));

  // The tables: two people at each, talking in turns.
  TABLES.forEach((spot, i) => {
    const pair = [talker(spot, i % 2 === 0), talker(spot, i % 2 === 1)];
    const converse = () => {
      if (!live()) return later(converse, 2500);
      const now = c.currentTime;
      // quiet hours: some tables sit empty, others talk less
      if (Math.random() > 0.15 + busy() * 0.85) return later(converse, rand(8000, 20000));
      let t = now + 0.05;
      let who = Math.random() < 0.5 ? 0 : 1;
      const turns = 1 + Math.floor(rand(0, 4));
      for (let k = 0; k < turns; k++) {
        t = pair[who].say(4 + Math.floor(rand(0, 13)), t) + rand(0.2, 0.8);
        who = 1 - who;
      }
      if (Math.random() < 0.1) {
        t = pair[who].laugh(t) + 0.3;
        if (Math.random() < 0.5) moment('Someone laughs across the room');
      }
      later(converse, (t - now) * 1000 + rand(600, 5000) / (0.4 + busy()));
    };
    later(converse, rand(200, 6000));
  });

  // Now and then a chair scrapes back from a table.
  const chair = () => {
    if (live() && Math.random() < 0.3 + busy() * 0.5) {
      const t = c.currentTime;
      const spot = TABLES[Math.floor(Math.random() * TABLES.length)];
      const out = placed(roomBus!, spot, 0.4);
      const len = rand(0.35, 0.8);
      const bp = filter('bandpass', rand(500, 900), 2.2);
      bp.frequency.setValueCurveAtTime(Float32Array.from({ length: 12 }, () => rand(450, 1300)), t, len);
      const g = gainNode(0);
      g.gain.setValueCurveAtTime(Float32Array.from({ length: 16 }, (_, k) => (k === 0 || k === 15 ? 0 : rand(0.008, 0.028))), t, len);
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueCurveAtTime(Float32Array.from({ length: 10 }, () => rand(80, 170)), t, len);
      o.connect(bp);
      noise('pink', t, len, bp);
      bp.connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    later(chair, rand(18000, 45000));
  };
  later(chair, rand(6000, 16000));

  // Somebody stirring sugar in, and cups going down on saucers.
  const table = () => {
    if (live()) {
      const t = c.currentTime;
      const out = placed(roomBus!, TABLES[Math.floor(Math.random() * TABLES.length)], 0.5);
      if (Math.random() < 0.35) for (let k = 0; k < 7; k++) spoonTick(t + k * rand(0.12, 0.16), out, rand(0.006, 0.011));
      else {
        cup(t, out, rand(0.03, 0.05), 0.9);
        if (Math.random() < 0.4) cup(t + rand(0.12, 0.3), out, 0.02, 1.2);
      }
    }
    later(table, rand(4000, 12000) / (0.5 + busy()));
  };
  later(table, rand(1500, 5000));

  // The door: its bell, and Lahore leaking in while it's open.
  const door = () => {
    if (live() && Math.random() < 0.35 + busy() * 0.6) openDoor();
    later(door, rand(35000, 80000));
  };
  later(door, rand(12000, 25000));
}

/* One person at a table. A voice is a buzz from the throat (a sawtooth, dulled)
   shaped by the mouth: three resonances, the formants, that move to make each
   vowel. Syllables are the formants jumping between vowels with the level
   dipping for the consonant between them, a hiss for the "s" sounds, the pitch
   drifting down across a sentence. From a few metres away, under the music,
   that is exactly what other people's conversation sounds like. */
const VOWELS: [number, number, number][] = [
  [730, 1090, 2440], // a
  [530, 1840, 2480], // e
  [270, 2290, 3010], // i
  [570, 840, 2410], // o
  [300, 870, 2240], // u
  [500, 1500, 2500], // ə
  [660, 1720, 2410], // æ
];
function talker(spot: Spot, female: boolean) {
  const c = ctx!;
  const f0 = female ? rand(185, 235) : rand(98, 132);
  const scale = female ? 1.14 : 1;
  const src = c.createOscillator();
  src.type = 'sawtooth';
  src.frequency.value = f0;
  const throat = filter('lowpass', 1600);
  const mix = gainNode(1);
  src.connect(throat).connect(mix);
  const breath = gainNode(0.06);
  noise('pink', c.currentTime, Infinity, breath);
  breath.connect(mix);
  const env = gainNode(0);
  const formants = [0, 1, 2].map((i) => {
    const f = filter('bandpass', VOWELS[5][i] * scale, [5, 8, 10][i]);
    const g = gainNode([1, 0.55, 0.28][i]);
    mix.connect(f).connect(g).connect(env);
    return f;
  });
  // the consonants: a little hiss
  const sib = gainNode(0);
  noise('white', c.currentTime, Infinity, filter('highpass', 4200)).connect(sib);
  const dist = Math.hypot(spot.x, spot.z);
  const out = placed(roomBus!, spot, 0.3);
  const far = filter('lowpass', 1200 + 2800 / (1 + dist / 2.5));
  env.connect(far);
  sib.connect(far);
  far.connect(out);
  src.start();
  const level = 0.2;

  const say = (syllables: number, at: number) => {
    let t = at;
    let pitch = f0 * rand(1.04, 1.16);
    const loud = level * rand(0.7, 1.15);
    for (let s = 0; s < syllables; s++) {
      const v = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      const dur = rand(0.1, 0.23);
      formants.forEach((f, i) => f.frequency.setTargetAtTime(v[i] * scale * rand(0.93, 1.07), t, 0.022));
      pitch *= rand(0.965, 1.005);
      src.frequency.setTargetAtTime(pitch * (Math.random() < 0.18 ? 1.13 : 1), t, 0.035);
      env.gain.setTargetAtTime(loud * rand(0.55, 1), t, 0.016);
      env.gain.setTargetAtTime(loud * 0.1, t + dur, 0.018);
      if (Math.random() < 0.28) {
        sib.gain.setTargetAtTime(loud * 0.05, t + dur, 0.01);
        sib.gain.setTargetAtTime(0, t + dur + 0.05, 0.012);
      }
      t += dur + rand(0.03, 0.08);
      if (Math.random() < 0.13) t += rand(0.1, 0.32); // a breath between words
    }
    env.gain.setTargetAtTime(0, t, 0.05);
    return t;
  };
  const laugh = (at: number) => {
    let t = at;
    formants.forEach((f, i) => f.frequency.setTargetAtTime(VOWELS[0][i] * scale, t, 0.02));
    for (let k = 0; k < 4 + Math.floor(rand(0, 3)); k++) {
      src.frequency.setTargetAtTime(f0 * (1.5 - k * 0.06), t, 0.02);
      env.gain.setTargetAtTime(level * 1.3, t, 0.01);
      sib.gain.setTargetAtTime(level * 0.03, t, 0.01);
      env.gain.setTargetAtTime(0, t + 0.09, 0.02);
      sib.gain.setTargetAtTime(0, t + 0.06, 0.02);
      t += rand(0.15, 0.2);
    }
    return t;
  };
  return { say, laugh };
}

/* The shop door opening onto the road: the bell over it, the handle, the
   traffic swelling in (a rickshaw passing, now and then a horn), the door
   swinging shut and the room closing back around you. */
function openDoor() {
  const c = ctx!;
  const t = c.currentTime;
  const out = placed(roomBus!, SPOTS.door);
  moment(Math.random() < 0.5 ? 'The door opens: the road outside comes in' : 'Someone comes in, the bell above the door');
  thud(t, out, 0.02, 400, 200, 0.03);
  for (let k = 0; k < 3; k++) strike(BELL, 1520 * rand(0.97, 1.04), t + 0.08 + k * rand(0.06, 0.13), 0.02 - k * 0.004, out, 0.1);
  const open = rand(3.5, 7);
  const street = gainNode(0);
  street.gain.setTargetAtTime(1, t + 0.15, 0.25);
  street.gain.setTargetAtTime(0, t + open, 0.18);
  street.connect(placed(roomBus!, SPOTS.street));
  noise('brown', t, open + 1.5, filter('lowpass', 420)).connect(gainNode(0.5)).connect(street);
  noise('pink', t, open + 1.5, filter('bandpass', 1300, 0.6)).connect(gainNode(0.05)).connect(street);
  // a rickshaw going past: a two-stroke putter that swells and falls in pitch
  if (Math.random() < 0.7) {
    const p0 = t + rand(0.3, 1.2), len = rand(2.2, 3.4);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(58, 66), p0);
    o.frequency.linearRampToValueAtTime(rand(46, 52), p0 + len);
    const putter = c.createOscillator();
    putter.type = 'square';
    putter.frequency.value = rand(11, 15);
    const am = gainNode(0.5);
    putter.connect(am);
    const g = gainNode(0);
    am.connect(g.gain);
    const env = gainNode(0);
    env.gain.setValueAtTime(0, p0);
    env.gain.linearRampToValueAtTime(0.09, p0 + len * 0.45);
    env.gain.linearRampToValueAtTime(0, p0 + len);
    const p = c.createPanner();
    p.panningModel = coarse() ? 'equalpower' : 'HRTF';
    p.refDistance = 2;
    if (p.positionX) {
      p.positionX.setValueAtTime(12, p0);
      p.positionX.linearRampToValueAtTime(-6, p0 + len);
      p.positionZ.value = 6;
    } else p.setPosition(3, 0, 6);
    o.connect(filter('lowpass', 900)).connect(g).connect(env).connect(p).connect(street);
    o.start(p0);
    putter.start(p0);
    o.stop(p0 + len + 0.1);
    putter.stop(p0 + len + 0.1);
  }
  // and a horn somewhere down the road
  if (Math.random() < 0.35) {
    const h0 = t + rand(0.6, 2.5);
    [415, 523].forEach((f) => {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f * rand(0.98, 1.02);
      const g = gainNode(0);
      for (let k = 0; k < 2; k++) {
        g.gain.setValueAtTime(0.012, h0 + k * 0.28);
        g.gain.setValueAtTime(0, h0 + k * 0.28 + 0.18);
      }
      o.connect(filter('lowpass', 1600)).connect(g).connect(street);
      o.start(h0);
      o.stop(h0 + 0.7);
    });
  }
  later(() => {
    if (!ctx) return;
    const s = ctx.currentTime;
    thud(s, out, 0.05, 85, 42, 0.16);
    strike(BELL, 1520, s + 0.05, 0.008, out, 0);
  }, open * 1000);
}

/* ── the bar: a drink being made, start to finish ──
   Every order is the real sequence: the ticket printing, the old puck knocked
   out, the grinder, the tamp, the portafilter locked in, the pump and the shot
   running, the milk steamed (a tearing hiss while it takes in air, then a
   smooth roll, the jug tapped on the counter), ice for the iced drinks, the
   cup set down, and now and then the counter bell. */
function startBar() {
  const c = ctx!;
  const bar = () => placed(barBus!, SPOTS.bar, 0.3);
  const DRINKS = ['latte', 'flat white', 'cortado', 'cappuccino', 'iced latte', 'espresso', 'iced matcha'];

  const ticket = (t: number) => {
    const out = placed(barBus!, SPOTS.till);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 380;
    const steps = c.createOscillator();
    steps.type = 'square';
    steps.frequency.value = 80;
    const depth = gainNode(0.5);
    steps.connect(depth);
    const g = gainNode(0);
    depth.connect(g.gain);
    const env = gainNode(0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + 0.05);
    env.gain.setValueAtTime(0.03, t + 1.1);
    env.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(filter('bandpass', 1400, 0.9)).connect(g).connect(env).connect(out);
    o.start(t);
    steps.start(t);
    o.stop(t + 1.25);
    steps.stop(t + 1.25);
  };
  const knock = (t: number) => {
    const out = bar();
    thud(t, out, 0.18, 120, 52, 0.12);
    thud(t + rand(0.17, 0.22), out, 0.14, 115, 50, 0.12);
  };
  const grind = (t: number, secs: number) => {
    const out = placed(barBus!, SPOTS.grinder);
    // the motor: spins up, hums under load, spins down
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    o.frequency.setValueCurveAtTime(Float32Array.from({ length: 12 }, () => rand(142, 152)), t + 0.35, secs - 0.8);
    o.frequency.exponentialRampToValueAtTime(35, t + secs + 0.5);
    const og = gainNode(0);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.08, t + 0.25);
    og.gain.setValueAtTime(0.08, t + secs);
    og.gain.exponentialRampToValueAtTime(0.0001, t + secs + 0.5);
    o.connect(filter('lowpass', 1100)).connect(og).connect(out);
    o.start(t);
    o.stop(t + secs + 0.55);
    // the beans: a dense crunch of tiny cracks, thinning out as the hopper empties
    const len = Math.floor(c.sampleRate * secs);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      if (Math.random() < 0.012 * (p < 0.75 ? 1 : (1 - p) * 4)) {
        const amp = rand(0.3, 1) * (Math.random() < 0.5 ? -1 : 1);
        for (let k = 0; k < 40 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 6) * (k % 2 ? -1 : 1);
      }
    }
    const s = c.createBufferSource();
    s.buffer = buf;
    const g = gainNode(0.2);
    s.connect(filter('bandpass', 2600, 0.7)).connect(g).connect(out);
    s.start(t + 0.2);
  };
  const tamp = (t: number) => thud(t, bar(), 0.05, 180, 90, 0.07);
  const lockIn = (t: number) => {
    const out = bar();
    strike(STEEL, 520, t, 0.025, out, 0.4);
    strike(STEEL, 540, t + 0.09, 0.02, out, 0.3);
  };
  const shot = (t: number, secs: number) => {
    const out = bar();
    // the vibratory pump: a 50 Hz buzz, harder in the first seconds
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 50;
    const pg = gainNode(0);
    pg.gain.setValueAtTime(0, t);
    pg.gain.linearRampToValueAtTime(0.08, t + 0.1);
    pg.gain.linearRampToValueAtTime(0.05, t + 2.5);
    pg.gain.setValueAtTime(0.05, t + secs - 0.2);
    pg.gain.linearRampToValueAtTime(0, t + secs);
    o.connect(filter('lowpass', 320)).connect(pg).connect(out);
    o.start(t);
    o.stop(t + secs + 0.05);
    // the shot running into the cup: a thin, bubbling trickle after pre-infusion
    const tr = gainNode(0);
    const start = t + 3;
    tr.gain.setValueCurveAtTime(Float32Array.from({ length: 80 }, (_, k) => (k < 3 || k > 76 ? 0 : rand(0.01, 0.035))), start, secs - 3);
    noise('white', start, secs - 3, filter('bandpass', 2400, 1.4)).connect(tr);
    tr.connect(out);
    // three-way valve at the end: a short hiss into the drip tray
    const v = gainNode(0);
    v.gain.setValueAtTime(0.03, t + secs);
    v.gain.exponentialRampToValueAtTime(0.0001, t + secs + 0.35);
    noise('white', t + secs, 0.4, filter('bandpass', 1500, 0.8)).connect(v);
    v.connect(out);
  };
  const steam = (t: number, secs: number) => {
    const out = bar();
    // purge the wand
    const pu = gainNode(0);
    pu.gain.setValueAtTime(0.1, t);
    pu.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    noise('white', t, 0.9, filter('highpass', 1800)).connect(pu);
    pu.connect(out);
    // then the milk: stretching (a ragged, tearing hiss as air goes in),
    // texturing (a smooth roll), the pitch dropping as the jug fills
    const m0 = t + 1.3;
    const bp = filter('bandpass', 3400, 0.55);
    bp.frequency.setValueAtTime(3400, m0);
    bp.frequency.linearRampToValueAtTime(2300, m0 + secs);
    const g = gainNode(0);
    const n = 160;
    const stretch = 0.35;
    g.gain.setValueCurveAtTime(
      Float32Array.from({ length: n }, (_, k) => {
        const p = k / (n - 1);
        if (p > 0.97) return 0;
        const base = 0.034 + 0.02 * Math.min(1, p * 8);
        return p < stretch ? base * (Math.random() < 0.45 ? rand(1.4, 2.2) : rand(0.4, 0.9)) : base * rand(0.92, 1.06);
      }),
      m0,
      secs,
    );
    noise('white', m0, secs, bp).connect(g);
    g.connect(out);
    // the jug tapped on the counter twice, and swirled
    const e = m0 + secs + 0.4;
    strike(STEEL, 720, e, 0.03, out, 0.5);
    strike(STEEL, 740, e + 0.28, 0.025, out, 0.5);
    const sw = gainNode(0);
    sw.gain.setValueCurveAtTime(Float32Array.from({ length: 20 }, (_, k) => (k === 0 || k === 19 ? 0 : 0.012 * (0.6 + 0.4 * Math.sin(k)))), e + 0.6, 1.2);
    noise('pink', e + 0.6, 1.3, filter('bandpass', 850, 1.2)).connect(sw);
    sw.connect(out);
    return e + 1.9;
  };
  const ice = (t: number) => {
    const out = bar();
    const sc = gainNode(0);
    sc.gain.setValueAtTime(0.02, t);
    sc.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    noise('white', t, 0.35, filter('bandpass', 3200, 1)).connect(sc);
    sc.connect(out);
    let s = t + 0.25;
    for (let k = 0; k < 9 + Math.floor(rand(0, 6)); k++) {
      strike(CERAMIC, rand(2600, 4200), s, rand(0.015, 0.035), out, 0.3);
      s += rand(0.02, 0.09);
    }
  };
  const serve = (t: number, drink: string) => {
    const out = bar();
    cup(t, out, 0.05, 0.85);
    if (Math.random() < 0.4) {
      strike(BELL, 2350, t + 0.5, 0.018, out, 0.2);
      moment(`Order up: ${/^[aeiou]/.test(drink) ? 'an' : 'a'} ${drink} on the counter`);
    }
  };

  const order = () => {
    if (!live()) return later(order, 4000);
    const drink = DRINKS[Math.floor(Math.random() * DRINKS.length)];
    const iced = drink.startsWith('iced');
    const milk = drink !== 'espresso' && !(iced && drink === 'iced matcha');
    const now = c.currentTime;
    let t = now + 0.1;
    ticket(t);
    moment(`A ticket prints: ${drink}`);
    if (drink === 'iced matcha') {
      // no espresso: the matcha is whisked, then over ice
      const w = gainNode(0);
      w.gain.setValueCurveAtTime(Float32Array.from({ length: 60 }, (_, k) => (k === 0 || k === 59 ? 0 : 0.012 * (0.5 + 0.5 * Math.abs(Math.sin(k * 1.3))))), t + 2, 4);
      noise('white', t + 2, 4.1, filter('bandpass', 5200, 1.5)).connect(w);
      w.connect(bar());
      later(() => moment('Whisking matcha'), 2000);
      t += 6.5;
      ice(t);
      t += 1.5;
    } else {
      later(() => live() && knock(ctx!.currentTime), 1500);
      later(() => {
        if (!live()) return;
        grind(ctx!.currentTime, rand(2.6, 3.6));
        moment('Grinding Slow Roast');
      }, 2600);
      later(() => live() && tamp(ctx!.currentTime), 6600);
      later(() => live() && lockIn(ctx!.currentTime), 7600);
      const shotSecs = rand(8, 10);
      later(() => {
        if (!live()) return;
        shot(ctx!.currentTime, shotSecs);
        moment('Pulling a shot: 92°C, 27 seconds');
      }, 8300);
      t = now + 8.3 + shotSecs;
      if (milk && !iced) {
        const s0 = now + 8.3 + shotSecs * 0.4;
        later(() => {
          if (!live()) return;
          steam(ctx!.currentTime, rand(6, 8.5));
          moment('Steaming milk to 65°C');
        }, (s0 - now) * 1000);
        t = s0 + 11;
      } else if (iced) {
        later(() => live() && ice(ctx!.currentTime), (t - now + 0.5) * 1000);
        t += 2;
      }
    }
    later(() => live() && serve(ctx!.currentTime, drink), (t - now + 0.8) * 1000);
    later(order, (t - now + 2) * 1000 + rand(5000, 26000) / (0.35 + busy()));
  };
  later(order, rand(1500, 4000));

  // between orders: cups stacked, a spoon dropped in the sink, the knock box
  const clatter = () => {
    if (live()) {
      const t = c.currentTime;
      const out = bar();
      const r = Math.random();
      if (r < 0.45) {
        cup(t, out, 0.04);
        if (Math.random() < 0.5) cup(t + rand(0.1, 0.35), out, 0.03, 1.1);
      } else if (r < 0.7) for (let k = 0; k < 4; k++) spoonTick(t + k * rand(0.05, 0.11), out, rand(0.01, 0.02));
      else strike(CERAMIC, 820, t, 0.04, out, 0.8); // a plate onto the stack
    }
    later(clatter, rand(4000, 12000) / (0.5 + busy()));
  };
  later(clatter, rand(1500, 4000));
}

/* ── music: slow lo-fi jazz on a real piano ──
   The notes are recordings of a grand piano (Salamander Grand Piano, sampled
   every minor third and pitched to the notes in between), played through a
   warm, slightly worn chain: rolled chords with rootless voicings, a walking
   left hand, a few melody notes on top, brushes and a soft kick, swung. */
const PIANO = ['A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6'];
const midiOf = (n: string) => {
  const m = /^([A-G])(s?)(\d)$/.exec(n)!;
  return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] ? 1 : 0);
};
type PianoSample = { midi: number; buf: AudioBuffer };
let piano: PianoSample[] = [];
let pianoLoading: Promise<void> | null = null;
let pianoReady = false;
let musicStatus: 'idle' | 'loading' | 'ready' | 'unavailable' = 'idle';
let musicProgress = { loaded: 0, total: 7 };
const musicListeners = new Set<(status: typeof musicStatus, progress: typeof musicProgress) => void>();
const publishMusicStatus = (status: typeof musicStatus) => {
  musicStatus = status;
  musicListeners.forEach((listener) => listener(status, { ...musicProgress }));
};
export const getMusicStatus = () => ({ status: musicStatus, ...musicProgress });
export const onMusicStatusChange = (listener: (status: typeof musicStatus, progress: typeof musicProgress) => void) => {
  musicListeners.add(listener);
  return () => musicListeners.delete(listener);
};

// Seven evenly spaced notes make a usable instrument quickly on mobile. The
// remaining samples add fidelity after the first notes are already playing.
const CORE_PIANO = [0, 3, 6, 9, 12, 14, 16].map((index) => PIANO[index]);
async function fetchPianoSample(name: string): Promise<PianoSample> {
  const response = await fetch(`/assets/sound/piano/${name}.mp3`);
  if (!response.ok) throw new Error(`Piano sample ${name} returned ${response.status}`);
  return { midi: midiOf(name), buf: await ctx!.decodeAudioData(await response.arrayBuffer()) };
}
function loadPiano() {
  if (pianoLoading) return pianoLoading;
  pianoLoading = (async () => {
    musicProgress = { loaded: 0, total: CORE_PIANO.length };
    publishMusicStatus('loading');
    await Promise.allSettled(CORE_PIANO.map(async (name) => {
      const sample = await fetchPianoSample(name);
      piano.push(sample);
      musicProgress = { ...musicProgress, loaded: musicProgress.loaded + 1 };
      musicListeners.forEach((listener) => listener(musicStatus, { ...musicProgress }));
      return sample;
    }));
    piano.sort((a, b) => a.midi - b.midi);
    pianoReady = piano.length > 0;
    publishMusicStatus(pianoReady ? 'ready' : 'unavailable');
    if (!pianoReady) return;

    const extras = PIANO.filter((name) => !CORE_PIANO.includes(name));
    const loadExtras = async () => {
      await Promise.allSettled(extras.map(async (name) => {
        const sample = await fetchPianoSample(name);
        piano.push(sample);
        piano.sort((a, b) => a.midi - b.midi);
      }));
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => { void loadExtras(); }, { timeout: 4000 });
    else globalThis.setTimeout(() => { void loadExtras(); }, 1500);
  })().finally(() => {
    pianoLoading = null;
  });
  return pianoLoading;
}

/* ── the house trio ──
   Piano, upright bass and drums playing a set of original tunes (lib/jazzScore.ts writes out every bar). The piano is
   the sampled grand, spread across the stereo field the way it sounds from a table in front of it; the bass is a
   plucked string modelled in the audio graph; the drums (ride, hi-hat foot, brushes, cross-stick, shaker) are rendered
   once into short buffers. Between tunes there is a pause, and sometimes a few tables clap. */
type NowPlaying = { title: string; feel: string; index: number; of: number } | null;
let nowPlaying: NowPlaying = null;
const nowListeners = new Set<(n: NowPlaying) => void>();
export const getNowPlaying = () => nowPlaying;
export const onNowPlaying = (f: (n: NowPlaying) => void) => {
  nowListeners.add(f);
  return () => nowListeners.delete(f);
};
let skipRequested = false;
/** Ends the tune being played (with a quick fade) and starts the next one. */
export function skipTune() {
  skipRequested = true;
}

/** Drum sounds, rendered once. Each is a short mono buffer computed sample by sample. */
function drumKit(c: BaseAudioContext) {
  const sr = c.sampleRate;
  const make = (secs: number, fn: (t: number, i: number) => number) => {
    const b = c.createBuffer(1, Math.floor(sr * secs), sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = fn(i / sr, i);
    return b;
  };
  // A cymbal is a cluster of inharmonic partials: square waves at unrelated frequencies, high-passed, plus noise.
  const metal = (freqs: number[], decay: number, ping: number, secs: number, noiseMix = 0.35) => {
    let xa = 0, ya = 0, xb = 0, yb = 0;
    return make(secs, (t) => {
      let v = 0;
      for (const f of freqs) v += Math.sign(Math.sin(2 * Math.PI * f * t));
      v = v / freqs.length + (Math.random() * 2 - 1) * noiseMix;
      // two first-order high-passes take away the body and leave the shimmer
      ya = 0.94 * (ya + v - xa);
      xa = v;
      yb = 0.9 * (yb + ya - xb);
      xb = ya;
      return yb * (Math.exp(-t / decay) * 0.7 + Math.exp(-t / ping) * 0.5);
    });
  };
  const RIDE = [322, 441, 587, 739, 1013, 1291].map((f) => f * 2.3);
  let lp = 0;
  return {
    ride: metal(RIDE, 0.55, 0.012, 1.6),
    chick: metal(RIDE.map((f) => f * 1.2), 0.03, 0.006, 0.12, 0.6),
    // a brushed snare: a short breath of noise, band-limited
    snare: make(0.35, (t) => {
      lp += 0.35 * ((Math.random() * 2 - 1) - lp);
      return lp * Math.exp(-t / 0.09) * (t < 0.004 ? t / 0.004 : 1);
    }),
    // cross-stick: a woody knock
    rim: make(0.12, (t) => (Math.sin(2 * Math.PI * 1650 * t) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.5 + (Math.random() * 2 - 1) * 0.3) * Math.exp(-t / 0.018)),
    // shaker: noise that swells and drops
    shaker: make(0.1, (t) => (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, t / 0.09)) * 0.5),
    kick: make(0.3, (t) => Math.sin(2 * Math.PI * (55 + 40 * Math.exp(-t / 0.03)) * t) * Math.exp(-t / 0.09)),
    // steady noise for the brushes to sweep with
    noise: make(1, () => Math.random() * 2 - 1),
  };
}
type Kit = ReturnType<typeof drumKit>;

/**
 * A band that plays notes into `out`. Kept apart from the scheduler so it can also be rendered offline.
 * `samples` are the piano recordings, lowest first.
 */
export function createTrio(c: BaseAudioContext, out: AudioNode, samples: { midi: number; buf: AudioBuffer }[], kit: Kit = drumKit(c)) {
  // Piano: a touch of warmth (gentle saturation, a lifted low-mid, the top rolled off like a room does).
  const shaper = c.createWaveShaper();
  shaper.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 1023) * 2 - 1) * 1.3) / Math.tanh(1.3));
  const pianoIn = c.createGain();
  // Balance: the piano leads, the bass sits a couple of dB under it, the drums further back.
  pianoIn.gain.value = 2.8;
  const body = c.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 240;
  body.gain.value = 2;
  const air = c.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 5200;
  air.Q.value = 0.5;
  pianoIn.connect(shaper).connect(body).connect(air).connect(out);
  const drums = c.createGain();
  drums.gain.value = 0.4;
  drums.connect(out);
  const bassBus = c.createGain();
  bassBus.gain.value = 0.3;
  bassBus.connect(out);

  const pan = (v: number) => {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v));
    return p;
  };
  const piano = (m: number, t: number, dur: number, vel: number) => {
    if (!samples.length) return;
    let s = samples[0];
    for (const p of samples) if (Math.abs(p.midi - m) < Math.abs(s.midi - m)) s = p;
    const src = c.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (m - s.midi) / 12);
    const g = c.createGain();
    // Softer notes are darker as well as quieter, as they are on a real piano.
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1400 + vel * 7000;
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + dur, 0.16); // the damper comes down
    // Low notes to the left, high to the right: the keyboard as heard from in front of it.
    src.connect(tone).connect(g).connect(pan((m - 62) / 36)).connect(pianoIn);
    src.start(t);
    src.stop(t + dur + 1.2);
  };
  // Upright bass: a plucked string. A sine for the fundamental and a quieter triangle an octave up give the tone; the
  // filter snaps open at the pluck and closes as the note dies, and the pitch settles a few cents after the attack.
  const bass = (m: number, t: number, dur: number, vel: number) => {
    const f = 440 * Math.pow(2, (m - 69) / 12);
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    [o1, o2].forEach((o, k) => {
      const fk = f * (k + 1);
      o.frequency.setValueAtTime(fk * 1.006, t);
      o.frequency.exponentialRampToValueAtTime(fk, t + 0.05);
    });
    const o2g = c.createGain();
    o2g.gain.value = 0.35;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(260 + vel * 900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.18);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    o1.connect(lp);
    o2.connect(o2g).connect(lp);
    lp.connect(g).connect(bassBus);
    // the finger on the string
    const thump = c.createBufferSource();
    thump.buffer = kit.snare;
    const tf = c.createBiquadFilter();
    tf.type = 'bandpass';
    tf.frequency.value = 180;
    const tg = c.createGain();
    tg.gain.value = vel * 0.35;
    thump.connect(tf).connect(tg).connect(bassBus);
    thump.start(t);
    thump.stop(t + 0.06);
    [o1, o2].forEach((o) => {
      o.start(t);
      o.stop(t + dur + 0.4);
    });
  };
  const hit = (buf: AudioBuffer, t: number, vel: number, where: number, rate = 1) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = vel;
    src.connect(g).connect(pan(where)).connect(drums);
    src.start(t);
  };
  // Brushes swept round the snare head: filtered noise that swells twice a bar.
  const swirl = (t: number, beats: number, spb: number, vel: number) => {
    const n = c.createBufferSource();
    n.buffer = kit.noise;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < beats / 2; k++) {
      g.gain.linearRampToValueAtTime(vel * 0.32, t + (k * 2 + 1) * spb);
      g.gain.linearRampToValueAtTime(vel * 0.1, t + (k * 2 + 2) * spb);
    }
    n.connect(bp).connect(g).connect(pan(-0.15)).connect(drums);
    n.start(t);
    n.stop(t + beats * spb + 0.05);
  };

  return {
    /** Plays one bar starting at `t`; returns its length in seconds. */
    bar(notes: import('./jazzScore').Note[], t: number, bpm: number) {
      const spb = 60 / bpm;
      for (const n of notes) {
        const at = t + n.t * spb;
        const d = n.dur * spb;
        switch (n.inst) {
          case 'piano': piano(n.midi!, at, d, n.vel); break;
          case 'bass': bass(n.midi!, at, d, n.vel); break;
          case 'ride': hit(kit.ride, at, n.vel * 0.5, 0.35); break;
          case 'chick': hit(kit.chick, at, n.vel * 0.45, 0.25); break;
          case 'snare': hit(kit.snare, at, n.vel * 0.9, -0.1); break;
          case 'rim': hit(kit.rim, at, n.vel * 0.55, -0.15); break;
          case 'shaker': hit(kit.shaker, at, n.vel * 0.35, 0.45); break;
          case 'kick': hit(kit.kick, at, n.vel * 1.1, 0); break;
          case 'swirl': swirl(at, n.dur, spb, n.vel); break;
        }
      }
      return 4 * spb;
    },
  };
}

function startMusic() {
  const c = ctx!;
  // The trio plays in the corner of the room: the music bus already goes to the room's reverb; each tune gets its own
  // gain so a skipped tune can fade out while the next one starts clean.
  let tuneGain: GainNode | null = null;
  let bars: Bar[] = [];
  let barI = 0;
  let next = 0;
  let setOrder: number[] = [];
  let setI = -1;
  let trio: ReturnType<typeof createTrio> | null = null;
  let kit: Kit | null = null;

  const startTune = () => {
    if (!setOrder.length || setI >= setOrder.length - 1) {
      setOrder = setList(Math.floor(pkHour()));
      setI = -1;
    }
    setI++;
    skipRequested = false;
    const tune = BOOK[setOrder[setI]];
    bars = perform(tune);
    barI = 0;
    tuneGain = gainNode(1);
    tuneGain.connect(musicBus!);
    kit ||= drumKit(c);
    trio = createTrio(c, tuneGain, piano, kit);
    next = c.currentTime + 0.3;
    nowPlaying = { title: tune.title, feel: FEEL_NAMES[tune.feel], index: setI + 1, of: setOrder.length };
    nowListeners.forEach((f) => f(nowPlaying));
  };

  const between = (ms: number) => {
    // A few tables clap for the trio, now and then.
    if (settings.ambience && Math.random() < 0.55) {
      const people = Math.floor(rand(3, 7));
      for (let p = 0; p < people; p++) {
        const x = rand(-3, 3), z = rand(-3.5, -0.5);
        const claps = Math.floor(rand(4, 9));
        const start = c.currentTime + rand(0.05, 0.5);
        const rate = rand(0.16, 0.22);
        const out = placed(roomBus!, { x, z });
        for (let k = 0; k < claps; k++) {
          const at = start + k * rate + rand(-0.02, 0.02);
          const g = gainNode(0);
          g.gain.setValueAtTime(rand(0.03, 0.06) * (1 - k / (claps * 1.4)), at);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
          noise('white', at, 0.07, filter('bandpass', rand(900, 1600), 1.2)).connect(g);
          g.connect(out);
        }
      }
      moment('A few tables clap for the trio');
    }
    later(() => {
      startTune();
      schedule();
    }, ms);
  };

  const schedule = () => {
    if (!live() || !settings.music) return later(schedule, 600);
    if (!pianoReady) {
      if (musicStatus !== 'unavailable') {
        void loadPiano();
        return later(schedule, 400);
      }
      // Retry a failed network fetch slowly while the rest of the café stays live.
      pianoLoading = null;
      return later(schedule, 8000);
    }
    if (!trio) startTune();
    if (skipRequested) {
      skipRequested = false;
      const old = tuneGain!;
      old.gain.setTargetAtTime(0, c.currentTime, 0.25);
      later(() => old.disconnect(), 2500);
      startTune();
    }
    // Fell behind (the tab was asleep): pick up from now rather than rushing to catch up.
    if (next < c.currentTime) next = c.currentTime + 0.1;
    while (barI < bars.length && next < c.currentTime + 3) {
      const bar = bars[barI++];
      next += trio!.bar(bar.notes, next, bar.bpm);
    }
    if (barI >= bars.length) {
      // Let the last chord ring, then a pause before the next tune.
      const wait = Math.max(0, next - c.currentTime) * 1000 + rand(4000, 7000);
      const old = tuneGain;
      later(() => old?.disconnect(), wait);
      trio = null;
      return later(() => between(rand(2500, 4500)), wait - 3000);
    }
    later(schedule, 500);
  };
  schedule();
}

/* ── scenes: the mix follows where you are on the page ── */
const SCENES: Record<string, { room: number; bar: number; music: number }> = {
  hero: { room: 0.8, bar: 0.6, music: 1 },
  menu: { room: 1, bar: 1, music: 0.8 },
  shop: { room: 0.6, bar: 0.5, music: 1 },
  locations: { room: 1, bar: 0.8, music: 0.8 },
  inside: { room: 1.2, bar: 1.2, music: 0.7 },
  brew: { room: 0.5, bar: 0.7, music: 1 },
  story: { room: 0.4, bar: 0.3, music: 1.2 },
  journey: { room: 0.5, bar: 0.4, music: 1.15 },
  hania: { room: 0.6, bar: 0.4, music: 1.2 },
  founder: { room: 0.7, bar: 0.5, music: 1 },
  reviews: { room: 0.9, bar: 0.7, music: 0.9 },
  club: { room: 0.9, bar: 0.8, music: 1 },
  order: { room: 0.8, bar: 1, music: 0.7 },
  faq: { room: 0.7, bar: 0.5, music: 0.9 },
  footer: { room: 0.5, bar: 0.3, music: 0.8 },
};
export function setSoundScene(name: string) {
  const s = SCENES[name];
  if (!s || (s.room === scene.room && s.bar === scene.bar && s.music === scene.music)) return;
  scene = s;
  apply();
}

/* ── ui sounds ── */

function clink(pitch: number, out: AudioNode, panTo = 0, level = 0.09, at?: number) {
  const c = ctx!;
  const now = at ?? c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(level, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  const pan = c.createStereoPanner();
  pan.pan.value = panTo;
  g.connect(pan).connect(out);
  [[1, 1], [1.5, 0.45], [2.76, 0.2]].forEach(([mul, amp]) => {
    const o = c.createOscillator();
    o.frequency.value = 1760 * pitch * mul;
    const a = c.createGain();
    a.gain.setValueAtTime(amp, now);
    a.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 / mul);
    o.connect(a).connect(g);
    o.start(now);
    o.stop(now + 0.5);
  });
}

const ui = () => (settings.on && settings.ui ? ensure() : null);

export function triggerHaptic(duration = 12) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {}
  }
}

export function playCupClink(pitchMultiplier = 1.0) {
  if (!ui()) return;
  clink(pitchMultiplier, uiBus!, 0, 0.08);
}

export function playBeanClatter() {
  const c = ui();
  if (!c) return;
  for (let k = 0; k < 5; k++) {
    const now = c.currentTime + k * rand(0.02, 0.06);
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, 0.04);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = rand(1400, 2600);
    f.Q.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    s.connect(f).connect(g).connect(uiBus!);
    s.start(now);
  }
}

export function playPaperFeed() {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  for (let k = 0; k < 3; k++) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(rand(160, 200), now + k * 0.035);
    const g = c.createGain();
    g.gain.setValueAtTime(0.018, now + k * 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.035 + 0.025);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    o.connect(lp).connect(g).connect(uiBus!);
    o.start(now + k * 0.035);
    o.stop(now + k * 0.035 + 0.03);
  }
}

export function playPaperTear() {
  triggerHaptic(25);
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const len = Math.floor(c.sampleRate * 0.32);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    // fibres giving way: a crackle of small ticks inside the rip
    const tick = Math.random() < 0.02 ? 2.5 : 1;
    d[i] = (Math.random() * 2 - 1) * tick * (0.6 + 0.4 * Math.sin(p * 90)) * Math.exp(-p * 3);
  }
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(3000, now);
  f.frequency.linearRampToValueAtTime(1400, now + 0.3);
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = 0.14;
  s.connect(f).connect(g).connect(uiBus!);
  s.start(now);
}

export function playPourDrop() {
  triggerHaptic(15);
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  // a drop, then a smaller one: liquid landing in liquid
  [[0, 900, 380, 0.08], [0.07, 1300, 700, 0.035]].forEach(([dt, f0, f1, lv]) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0, now + dt);
    o.frequency.exponentialRampToValueAtTime(f1, now + dt + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + dt);
    g.gain.linearRampToValueAtTime(lv, now + dt + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.14);
    o.connect(g).connect(uiBus!);
    o.start(now + dt);
    o.stop(now + dt + 0.15);
  });
}

export function playSoftClick() {
  triggerHaptic(8);
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c, 0.02);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
  s.connect(f).connect(g).connect(uiBus!);
  s.start(now);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 620;
  const og = c.createGain();
  og.gain.setValueAtTime(0.025, now);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  o.connect(og).connect(uiBus!);
  o.start(now);
  o.stop(now + 0.035);
}

/** The faintest tick, for hovering over things you can press. */
export function playHoverTick() {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.frequency.value = 2100;
  const g = c.createGain();
  g.gain.setValueAtTime(0.008, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
  o.connect(g).connect(uiBus!);
  o.start(now);
  o.stop(now + 0.02);
}

/** A soft air movement, for panels opening and closing. */
export function playWhoosh(opening = true) {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c, 0.45, 'pink');
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(opening ? 400 : 1400, now);
  f.frequency.exponentialRampToValueAtTime(opening ? 1600 : 350, now + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.06, now + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  s.connect(f).connect(g).connect(uiBus!);
  s.start(now);
}

/** Two warm notes: something good happened (order placed, review posted). */
export function playChime() {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  [[0, 72], [0.12, 79], [0.24, 84]].forEach(([dt, m]) => {
    const o = c.createOscillator();
    o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + dt);
    g.gain.linearRampToValueAtTime(0.05, now + dt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.9);
    o.connect(g).connect(uiBus!);
    o.start(now + dt);
    o.stop(now + dt + 1);
  });
}

/** A message arriving, or leaving. */
export function playMessage(incoming = true) {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const [a, b] = incoming ? [880, 1320] : [1320, 990];
  [[0, a], [0.07, b]].forEach(([dt, f]) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.04, now + dt);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dt + 0.12);
    o.connect(g).connect(uiBus!);
    o.start(now + dt);
    o.stop(now + dt + 0.13);
  });
}

/* ── the receipt printer ──
   A thermal printer is a stepper motor pulling paper past a hot head: a buzzy
   whine whose pitch follows the feed speed, a rapid tick of motor steps, and a
   faint sizzle from the head. `printerFeed(speed)` is called while paper moves
   (speed 0–1); the motor spins down on its own when calls stop. When the slip
   is out, `printerCut()` plays the auto-cutter's zip and clack. */
let printer: { osc: OscillatorNode; steps: OscillatorNode; gain: GainNode; hiss: GainNode; stop: number } | null = null;

export function printerFeed(speed = 1) {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  const s = clamp(speed, 0.15, 1);
  if (!printer) {
    const gain = c.createGain();
    gain.gain.value = 0;
    const body = c.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = 1400;
    body.Q.value = 0.9;
    gain.connect(body).connect(uiBus!);
    // motor whine
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 300;
    const og = c.createGain();
    og.gain.value = 0.35;
    osc.connect(og).connect(gain);
    // motor steps: a square wave gating the whine, heard as a fast tick
    const steps = c.createOscillator();
    steps.type = 'square';
    steps.frequency.value = 60;
    const depth = c.createGain();
    depth.gain.value = 0.5;
    steps.connect(depth).connect(og.gain);
    // the head: filtered noise
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, 2);
    n.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const hiss = c.createGain();
    hiss.gain.value = 0;
    n.connect(hp).connect(hiss).connect(uiBus!);
    osc.start();
    steps.start();
    n.start();
    printer = { osc, steps, gain, hiss, stop: 0 };
  }
  printer.osc.frequency.setTargetAtTime(220 + s * 260, now, 0.05);
  printer.steps.frequency.setTargetAtTime(35 + s * 70, now, 0.05);
  printer.gain.gain.setTargetAtTime(0.11 + s * 0.09, now, 0.03);
  printer.hiss.gain.setTargetAtTime(0.012 + s * 0.016, now, 0.03);
  // Spin down shortly after the last call.
  window.clearTimeout(printer.stop);
  printer.stop = window.setTimeout(() => {
    if (!printer || !ctx) return;
    const t = ctx.currentTime;
    printer.osc.frequency.setTargetAtTime(120, t, 0.06);
    printer.gain.gain.setTargetAtTime(0, t, 0.05);
    printer.hiss.gain.setTargetAtTime(0, t, 0.04);
  }, 140);
}

export function printerCut() {
  const c = ui();
  if (!c) return;
  const now = c.currentTime;
  // blade travelling across: a short rising zip
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c, 0.2);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(1500, now);
  f.frequency.exponentialRampToValueAtTime(4200, now + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  s.connect(f).connect(g).connect(uiBus!);
  s.start(now);
  // and the clack as it snaps back
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, now + 0.15);
  o.frequency.exponentialRampToValueAtTime(260, now + 0.2);
  const og = c.createGain();
  og.gain.setValueAtTime(0.1, now + 0.15);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  o.connect(og).connect(uiBus!);
  o.start(now + 0.15);
  o.stop(now + 0.25);
  triggerHaptic(10);
}
