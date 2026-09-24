/**
 * brewns sound: a living café under the page, plus small tactile sounds for
 * what you touch. Everything is synthesised with the Web Audio API (no
 * downloads), and all of it runs through one master bus so the volume and
 * switches in the sound panel apply everywhere.
 *
 * Layers
 *   room     low room tone and a murmur of voices, with a small-room reverb
 *   bar      the espresso machine: grinder bursts, steam wand, cup clinks
 *   music    a slow, warm lo-fi bed (Rhodes-like chords, soft kick and brush)
 *   ui       clicks, pours, the printer, message pops, chimes
 *
 * A real recording, if one is placed at public/assets/sound/cafe.mp3, replaces
 * the synthesised room and bar automatically.
 *
 * Nothing plays until the visitor turns sound on (browsers require a click),
 * and it fades out when the tab is hidden.
 */

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
const timers: number[] = [];
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
  // Browsers only allow audio after a gesture: resume on the first one.
  if (settings.on) {
    const wake = () => {
      start();
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !master) return;
    fade(master.gain, document.hidden || !settings.on ? 0 : settings.volume, 0.6);
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

function apply() {
  if (!ctx || !master || !roomBus || !barBus || !musicBus || !uiBus) return;
  fade(master.gain, settings.on && !document.hidden ? settings.volume : 0, settings.on ? 1.5 : 0.5);
  fade(roomBus.gain, settings.ambience ? 0.9 * scene.room : 0, 1.8);
  fade(barBus.gain, settings.ambience ? 0.8 * scene.bar : 0, 1.8);
  fade(musicBus.gain, settings.music ? 0.55 * scene.music : 0, 2.2);
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
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
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
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** A decaying burst of noise, the reverb of a small, soft-furnished room. */
function roomImpulse(c: AudioContext, secs: number) {
  const len = Math.floor(c.sampleRate * secs);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
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
async function tryRecording() {
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

/* ── room: tone and the murmur of voices ── */
function startRoom() {
  const c = ctx!;
  const tone = c.createBufferSource();
  tone.buffer = noiseBuffer(c, 6, 'brown');
  tone.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const tg = c.createGain();
  tg.gain.value = 0.22;
  tone.connect(lp).connect(tg).connect(roomBus!);
  tone.start();

  // Several "voices": speech-band noise, each shaped by a slow, uneven
  // syllable rhythm, panned around the room.
  for (let v = 0; v < 6; v++) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 4 + v, 'pink');
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(350, 900);
    bp.Q.value = rand(0.8, 1.6);
    const formant = c.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.value = rand(1200, 2400);
    formant.gain.value = 6;
    const g = c.createGain();
    g.gain.value = 0;
    const pan = c.createStereoPanner();
    pan.pan.value = rand(-0.8, 0.8);
    src.connect(bp).connect(formant).connect(g).connect(pan).connect(roomBus!);
    src.start();
    const speak = () => {
      const now = c.currentTime;
      const words = Math.floor(rand(3, 12));
      let t = now;
      for (let w = 0; w < words; w++) {
        const peak = rand(0.02, 0.07);
        g.gain.setTargetAtTime(peak, t, 0.03);
        t += rand(0.12, 0.3);
        g.gain.setTargetAtTime(peak * 0.25, t, 0.04);
        t += rand(0.05, 0.14);
        bp.frequency.setTargetAtTime(rand(300, 950), t, 0.1);
      }
      g.gain.setTargetAtTime(0, t, 0.2);
      timers.push(window.setTimeout(speak, (t - now) * 1000 + rand(600, 4500)));
    };
    timers.push(window.setTimeout(speak, rand(0, 3000)));
  }

  // Now and then a laugh somewhere across the room.
  const laugh = () => {
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 2;
    const g = c.createGain();
    g.gain.value = 0;
    const pan = c.createStereoPanner();
    pan.pan.value = rand(-0.9, 0.9);
    o.frequency.value = rand(190, 260);
    o.connect(f).connect(g).connect(pan).connect(roomBus!);
    for (let k = 0; k < 4; k++) {
      const t = now + k * 0.16;
      g.gain.setTargetAtTime(0.012, t, 0.01);
      g.gain.setTargetAtTime(0, t + 0.08, 0.03);
      o.frequency.setValueAtTime(o.frequency.value * (1 - k * 0.04), t);
    }
    o.start(now);
    o.stop(now + 0.9);
    timers.push(window.setTimeout(laugh, rand(14000, 38000)));
  };
  timers.push(window.setTimeout(laugh, rand(8000, 20000)));
}

/* ── the bar: grinder, steam wand, knock box, cups ── */
function startBar() {
  const c = ctx!;
  const pan = c.createStereoPanner();
  pan.pan.value = -0.35;
  pan.connect(barBus!);
  const burst = (secs: number, type: BiquadFilterType, freq: number, q: number, level: number, colour: 'white' | 'pink' = 'white') => {
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, secs + 0.2, colour);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.08);
    g.gain.setValueAtTime(level, now + secs - 0.3);
    g.gain.linearRampToValueAtTime(0, now + secs);
    src.connect(f).connect(g).connect(pan);
    src.start(now);
    src.stop(now + secs + 0.1);
    return { f, g, now };
  };
  const grinder = () => {
    const secs = rand(2.5, 4);
    const { f, now } = burst(secs, 'bandpass', 420, 1.2, 0.05);
    // the motor hum under the noise
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 118;
    const og = c.createGain();
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.012, now + 0.2);
    og.gain.linearRampToValueAtTime(0, now + secs);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    o.connect(lp).connect(og).connect(pan);
    o.start(now);
    o.stop(now + secs);
    f.frequency.linearRampToValueAtTime(520, now + secs);
  };
  const steam = () => {
    const secs = rand(4, 7);
    const { f, now } = burst(secs, 'highpass', 3200, 0.7, 0.03);
    // the wand climbs as the milk heats: the pitch of the hiss rises
    f.frequency.linearRampToValueAtTime(5200, now + secs * 0.8);
  };
  const knock = () => {
    const now = c.currentTime;
    for (let k = 0; k < 2; k++) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, now + k * 0.18);
      o.frequency.exponentialRampToValueAtTime(55, now + k * 0.18 + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.09, now + k * 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.18 + 0.15);
      o.connect(g).connect(pan);
      o.start(now + k * 0.18);
      o.stop(now + k * 0.18 + 0.16);
    }
  };
  const cups = () => {
    clink(rand(0.8, 1.3), barBus!, rand(-0.9, 0.9), 0.035);
    if (Math.random() < 0.4) timers.push(window.setTimeout(() => clink(rand(0.8, 1.3), barBus!, rand(-0.9, 0.9), 0.025), rand(120, 400)));
  };
  const spoon = () => {
    const now = c.currentTime;
    for (let k = 0; k < 6; k++) clink(2.2 + Math.random() * 0.2, barBus!, 0.5, 0.008, now + k * 0.11);
  };
  // An espresso shot is a small sequence: knock, grind, then later the steam.
  const order = () => {
    knock();
    timers.push(window.setTimeout(grinder, 900));
    if (Math.random() < 0.7) timers.push(window.setTimeout(steam, rand(9000, 14000)));
    timers.push(window.setTimeout(order, rand(22000, 42000)));
  };
  const clatter = () => {
    Math.random() < 0.3 ? spoon() : cups();
    timers.push(window.setTimeout(clatter, rand(3500, 11000)));
  };
  timers.push(window.setTimeout(order, rand(2000, 6000)));
  timers.push(window.setTimeout(clatter, rand(1500, 4000)));
}

/* ── music: a slow lo-fi bed ── */
function startMusic() {
  const c = ctx!;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  lp.connect(musicBus!);
  // A little tape wobble on everything.
  const wob = c.createOscillator();
  wob.frequency.value = 0.35;
  const wobG = c.createGain();
  wobG.gain.value = 4;
  wob.connect(wobG);
  wob.start();

  const BPM = 78;
  const beat = 60 / BPM;
  // Imaj7 – vi7 – ii7 – V7 in D♭, voiced warm and low.
  const CHORDS = [
    [49, 56, 60, 63, 68],
    [46, 53, 56, 61, 65],
    [51, 58, 61, 65, 68],
    [44, 51, 56, 60, 63],
  ];
  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const key = (m: number, t: number, dur: number, level: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(level * 0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(lp);
    // Rhodes-ish: a sine with a soft bell partial
    [[1, 1], [2, 0.18], [3.98, 0.05]].forEach(([mul, amp]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(m) * mul;
      wobG.connect(o.detune);
      const a = c.createGain();
      a.gain.value = amp;
      o.connect(a).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  };
  const kick = (t: number) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + 0.32);
  };
  const brush = (t: number, level: number) => {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, 0.25, 'white');
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5000;
    const g = c.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f).connect(g).connect(lp);
    s.start(t);
  };
  // Vinyl crackle under it all.
  const crackle = c.createBufferSource();
  const cb = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const cd = cb.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.6 : 0;
  crackle.buffer = cb;
  crackle.loop = true;
  const cg = c.createGain();
  cg.gain.value = 0.25;
  crackle.connect(cg).connect(musicBus!);
  crackle.start();

  let bar = 0;
  let next = c.currentTime + 0.3;
  const schedule = () => {
    while (next < c.currentTime + 2) {
      const ch = CHORDS[bar % 4];
      ch.forEach((m, i) => key(m, next + i * 0.015, beat * 4, i === 0 ? 0.05 : 0.028));
      // a small melody note or two on top, not every bar
      if (Math.random() < 0.6) key(ch[2 + Math.floor(Math.random() * 3)] + 12, next + beat * (1.5 + Math.floor(Math.random() * 2)), beat * 1.5, 0.018);
      for (let b = 0; b < 4; b++) {
        const t = next + b * beat;
        if (b === 0 || b === 2) kick(t);
        brush(t + beat / 2, 0.02);
        if (b === 1 || b === 3) brush(t, 0.05);
      }
      next += beat * 4;
      bar++;
    }
    timers.push(window.setTimeout(schedule, 500));
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
  story: { room: 0.4, bar: 0.3, music: 1.2 },
  hania: { room: 0.6, bar: 0.4, music: 1.2 },
  founder: { room: 0.7, bar: 0.5, music: 1 },
  reviews: { room: 0.9, bar: 0.7, music: 0.9 },
  order: { room: 0.8, bar: 1, music: 0.7 },
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
