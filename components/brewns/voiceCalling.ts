'use client';

import { hasDevanagari, toUrduScript } from '@/lib/devanagari';
import { cafeHoursStatusLabel, getCafeOpeningStatus } from '@/lib/openingHours';
import { LiveSession, type LiveEvent } from './liveSession';

/* The brewns concierge in the browser, two ways to reach the same person:

   CALL — it rings like a phone (a real UK-style double ring) while the line
   connects in the background, then Sarah picks up and says hello. On the live
   line her voice is Gemini's own native audio: the caller's voice goes in and
   hers comes out, no transcribe → think → speak relay, so she answers in well
   under a second and stops the moment you talk over her. Bookings and the bag
   run on our server mid-call, on the same open line. If the live line isn't
   available, the call still works step by step: we hear you (Groq Whisper),
   she thinks (the same brain as messages), she speaks (ElevenLabs, Orpheus or
   Gemini voices, a sentence at a time so the first words come quickly).

   MESSAGE — the same conversation as a chat. Switch either way at any time;
   the conversation carries over, so a call can pick up where a chat left off. */

export interface VoiceCallingDeps {
  cart: {
    add: (id: string, sel: Record<string, number>, qty?: number, message?: string) => void;
    count: () => number;
  };
  productById: (id: string) => any;
  defaultSel: (product: any) => Record<string, number>;
  openBag: () => void;
  toast: (msg: string, actionLabel?: string, onAction?: () => void) => void;
  playChime?: () => void;
  playSoftClick?: () => void;
  triggerHaptic?: (ms?: number) => void;
}

type Mode = 'call' | 'message';
type Phase = 'idle' | 'ringing' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'muted' | 'ended';
type Turn = { role: 'user' | 'assistant'; content: string };
type Action = { type: string; data?: any };
type Engine = 'live' | 'steps';
type AudioChunk = { text: string; url: string };

/** Picked up after one ring or two, like someone reaching for the phone, never instantly. */
const ringFor = () => (Math.random() < 0.55 ? 2600 : 5600) + Math.random() * 500;
/** A breath before each reply on the live line, never quite the same. Short: Gemini
    already waits 1.5 s of silence before it answers, so callers can pause mid-thought. */
const humanBeat = () => 0.12 + Math.random() * 0.22;
/** Speech louder than the room for this long counts as the caller talking. */
const SPEECH_START_MS = 150;
/** A pause this long after speaking means "I'm done", on the step-by-step line.
    At 0.7 s, "Sorry, one more thing. [breath] Do you have oat milk?" lost its question. */
const SPEECH_END_MS = 1100;
const SPEECH_MAX_MS = 15000;
const BARGE_IN_MS = 320;
/** On the live line: this loud, for this long, over Sarah's voice is the caller cutting in. */
const LIVE_BARGE_LEVEL = 0.03;
const LIVE_BARGE_MS = 250;
const PICKUP_CUE = 'The caller has just picked up the phone.';

type Lang = 'en' | 'ur';
type Who = 'female' | 'male';
const NAMES: Record<Lang, Record<Who, string>> = { en: { female: 'Sarah', male: 'Hamza' }, ur: { female: 'سارہ', male: 'حمزہ' } };
const UI = {
  en: {
    call: 'Call', message: 'Message', type: 'Type', end: 'End', mute: 'Mute', unmute: 'Unmute',
    dial: (n: string) => `Call ${n}`, talkTo: (n: string) => `Talk to ${n}`,
    subtitle: (g: Who) => (g === 'female' ? 'Front desk · brewns Lahore' : 'Roastery & bar · brewns Lahore'),
    replies: 'Usually replies instantly', ringing: 'Ringing…', connecting: 'Connecting…', connected: 'Connected',
    listening: 'Listening', speaking: (n: string) => `${n} is speaking`, thinking: 'One moment…', muted: 'You’re muted', ended: 'Call ended',
    typing: (n: string) => `${n} is typing…`, pickedUp: (n: string) => `${n} picked up`, callEnded: (t: string) => `Call ended · ${t}`, dropped: (t: string) => `The line dropped · ${t}`,
    transferring: (n: string) => `Transferring to ${n}…`, transferred: (n: string) => `Transferred to ${n}`,
    reconnecting: 'Reconnecting…', reconnected: 'Line restored', fellBack: 'The line broke up, so we’re carrying on over the backup line.', micBack: 'Microphone reconnected',
    hello: (n: string) => `Hi! It’s ${n} at brewns. Ask me anything, or tap a suggestion below.`,
    placeholder: 'Type a message…', tryMic: 'Try the mic again', msgInstead: 'Message instead', noConnect: 'Call didn’t connect',
    micBlocked: 'Your microphone is blocked for this site. Allow it from the icon in the address bar, or keep going by message.',
    micMissing: 'We couldn’t reach your microphone. Check it isn’t in use by another app, or keep going by message.',
    chips: [
      ['Order a classic smash burger and an iced latte for delivery', 'Burger & iced latte'],
      ['I want to book a table for 4 at Gulberg tomorrow evening', 'Book a table'],
      ['I want to book a private party for 15 guests at the DHA terrace', 'Plan a party'],
      ['Order a bag of Slow Roast whole beans', 'Slow Roast beans'],
      ['What are your hours and where are you?', 'Hours & locations'],
    ],
  },
  ur: {
    call: 'کال', message: 'پیغام', type: 'لکھیں', end: 'ختم', mute: 'خاموش', unmute: 'آواز کھولیں',
    dial: (n: string) => `${n} کو کال کریں`, talkTo: (n: string) => `${n} سے بات کریں`,
    subtitle: (g: Who) => (g === 'female' ? 'فرنٹ ڈیسک · brewns لاہور' : 'روسٹری اور بار · brewns لاہور'),
    replies: 'عموماً فوراً جواب دیتے ہیں', ringing: 'گھنٹی جا رہی ہے…', connecting: 'ملا رہے ہیں…', connected: 'کال مل گئی',
    listening: 'سن رہے ہیں', speaking: (n: string) => `${n} بات کر رہی ہیں`, thinking: 'ایک لمحہ…', muted: 'آپ کا مائیک بند ہے', ended: 'کال ختم ہو گئی',
    typing: (n: string) => `${n} لکھ رہی ہیں…`, pickedUp: (n: string) => `${n} نے کال اٹھا لی`, callEnded: (t: string) => `کال ختم · ${t}`, dropped: (t: string) => `لائن کٹ گئی · ${t}`,
    transferring: (n: string) => `${n} سے ملا رہے ہیں…`, transferred: (n: string) => `${n} کو منتقل`,
    reconnecting: 'دوبارہ ملا رہے ہیں…', reconnected: 'لائن بحال ہو گئی', fellBack: 'لائن کمزور ہو گئی تھی، اس لیے بیک اپ لائن پر بات جاری ہے۔', micBack: 'مائیک دوبارہ مل گیا',
    hello: (n: string) => `السلام علیکم! میں ${n} ہوں، brewns سے۔ جو چاہیں پوچھیے، یا نیچے سے کوئی آپشن چنیے۔`,
    placeholder: 'پیغام لکھیں…', tryMic: 'مائیک دوبارہ آزمائیں', msgInstead: 'پیغام بھیجیں', noConnect: 'کال نہیں مل سکی',
    micBlocked: 'اس سائٹ کے لیے آپ کا مائیک بند ہے۔ ایڈریس بار کے آئیکن سے اجازت دیں، یا پیغام سے بات جاری رکھیں۔',
    micMissing: 'آپ کا مائیک نہیں مل سکا۔ دیکھ لیں کہ کوئی اور ایپ اسے استعمال تو نہیں کر رہی، یا پیغام سے بات جاری رکھیں۔',
    chips: [
      ['مجھے ایک اسمیش برگر اور ایک آئسڈ لاٹے ڈیلیوری کے لیے آرڈر کرنا ہے', 'برگر اور آئسڈ لاٹے'],
      ['کل شام گلبرگ میں چار لوگوں کے لیے ٹیبل بک کرنی ہے', 'ٹیبل بک کریں'],
      ['ڈی ایچ اے ٹیرس پر پندرہ مہمانوں کی پرائیویٹ پارٹی بک کرنی ہے', 'پارٹی پلان کریں'],
      ['سلو روسٹ کافی بینز کا ایک بیگ چاہیے', 'سلو روسٹ بینز'],
      ['آپ کب کھلتے ہیں اور آپ کی برانچز کہاں ہیں؟', 'اوقات اور پتے'],
    ],
  },
};

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isUrdu = (t: string) => /[\u0600-\u06FF]/.test(t);
/** Urdu written in English letters ("mujhe kal table chahiye"): two of these words is enough. */
const romanUrdu = (t: string) => (t.match(/\b(mujhe|mujhay|hai|hain|kya|kia|aap|ap|chahiye|chahie|kal|sham|baje|nahi|nahin|haan|ji|jee|theek|thik|acha|achha|shukriya|karna|karni|kar|dein|logon|liye|mein|ke|ki|ka)\b/gi) || []).length >= 2;
/** Whisper sometimes "hears" these in silence. */
const PHANTOM = /^(thank you|thanks for watching|subtitles.*|transcription.*|you|bye|\.+)\.?$/i;

function rms(an: AnalyserNode, buf: Float32Array<ArrayBuffer>) {
  an.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export function initVoiceCalling({ cart, productById, defaultSel, openBag, toast, playChime, playSoftClick, triggerHaptic }: VoiceCallingDeps) {
  if (typeof window === 'undefined') return () => {};
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const modal = $('voice-call-modal');
  if (!modal) return () => {};

  const logEl = $('vc-log')!;
  const phaseEl = $('voice-caption-status');
  const timerEl = $('voice-call-timer');
  const hoursEl = $('voice-hours-status');
  const hoursLabel = $('voice-hours-label');
  const nameEl = $('vc-agent-title');
  const subtitleEl = $('vc-agent-subtitle');
  const monoEl = $('vc-avatar-mono');
  const voiceTagEl = $('vc-voice-tag');
  const alertEl = $('voice-unblock-actions');
  const alertText = $('vc-alert-text');
  const chipsEl = $('voice-chips-wrap');
  const inputRow = $<HTMLFormElement>('voice-input-row');
  const textInput = $<HTMLInputElement>('voice-text-input');
  const micBtn = $('voice-mic-toggle');
  const micLabel = $('voice-mic-label');
  const keypadBtn = $('voice-keypad-toggle');
  const langBtn = $('vc-lang-toggle');
  const tabs = [...modal.querySelectorAll<HTMLButtonElement>('.vcall-tab')];

  const ac = new AbortController();
  const on = (el: EventTarget | null, ev: string, fn: (e: any) => void) => el?.addEventListener(ev, fn, { signal: ac.signal });

  /* ── state ── */
  let mode: Mode = 'call';
  let phase: Phase = 'idle';
  let gender: 'female' | 'male' = 'female';
  let lang: 'en' | 'ur' = /^ur/i.test(navigator.language) ? 'ur' : 'en';
  let history: Turn[] = [];
  let scriptState: unknown = {};
  /** One id per call or chat, so the café's call log can follow it live. */
  let callId = uuid();
  let inCall = false;
  /** Bumped whenever a call starts or ends, so work for an old call stops. */
  let callSeq = 0;
  let engine: Engine = 'steps';
  let muted = false;
  let hangUpAfterSpeech = false;
  let seconds = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let hoursTimer: ReturnType<typeof setInterval> | undefined;
  let stopRing: (() => void) | null = null;

  /* audio */
  let ctx: AudioContext | null = null;
  let outGain: GainNode | null = null;
  let outAnalyser: AnalyserNode | null = null;
  let micStream: MediaStream | null = null;
  let micAnalyser: AnalyserNode | null = null;
  const outBuf = new Float32Array(1024);
  const micBuf = new Float32Array(1024);
  let raf = 0;
  let level = 0;

  /* live line */
  let live: LiveSession | null = null;
  let userBuf = '';
  let agentBuf = '';
  let userLi: HTMLLIElement | null = null;
  let agentLi: HTMLLIElement | null = null;
  let lastCaller = '';
  let lastAgent = '';
  let liveTurnDone = true;
  /** The live line is being re-established after a drop, or swapped before Gemini recycles it. */
  let reconnecting = false;
  /** Gemini warned it will recycle the connection: swap lines at the next quiet moment. */
  let recycleDue = false;
  /** The room's level between turns, and since when the caller has been talking over Sarah. */
  let liveFloor = 0.004;
  let liveLoudSince = 0;
  /** When "You …" went up, and when the caller last made a sound. */
  let hearingSince = 0;
  let lastVoiceAt = 0;
  /** The chat's welcome line; it follows the language until the guest writes something. */
  let welcomeLi: HTMLLIElement | null = null;

  /* step-by-step line */
  let turnId = 0;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  const vad = { talking: false, since: 0, quietSince: 0, startedAt: 0, floor: 0.004, armedAt: 0, loudSince: 0 };
  let player: HTMLAudioElement | null = null;
  let playerRouted = false;
  let utterance: SpeechSynthesisUtterance | null = null;

  const agent = () => NAMES.en[gender];
  /** The agent's name as the panel shows it, in the panel's language. */
  const shown = (g: Who = gender) => NAMES[lang][g];
  const ui = () => UI[lang];
  /** Urdu labels follow who's on the line: Sarah "کر رہی ہیں", Hamza "کر رہے ہیں". */
  const gendered = (s: string) => (lang === 'ur' && gender === 'male' ? s.replace('رہی ہیں', 'رہے ہیں') : s);

  /* ═════════ the screen ═════════ */

  function setPhase(next: Phase, label?: string) {
    phase = next;
    modal!.dataset.phase = next;
    const t = ui();
    const text =
      label ??
      {
        idle: mode === 'message' ? t.replies : '',
        ringing: t.ringing,
        connecting: t.connecting,
        listening: t.listening,
        speaking: gendered(t.speaking(shown())),
        thinking: t.thinking,
        muted: t.muted,
        ended: t.ended,
      }[next];
    if (phaseEl) phaseEl.textContent = text;
    micBtn?.setAttribute('aria-pressed', String(muted));
    micBtn?.setAttribute('aria-label', muted ? t.unmute : t.mute);
    if (micLabel) micLabel.textContent = muted ? t.unmute : t.mute;
  }

  function setMode(next: Mode) {
    mode = next;
    modal!.dataset.mode = next;
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.mode === next));
    if (next === 'message') {
      inputRow?.classList.add('open');
      if (!logEl.children.length) welcomeLi = say(ui().hello(shown()));
      if (!inCall) setPhase('idle');
      setTimeout(() => textInput?.focus(), 50);
    } else {
      inputRow?.classList.remove('open');
      keypadBtn?.setAttribute('aria-expanded', 'false');
      if (!inCall) setPhase(phase === 'ended' ? 'ended' : 'idle');
    }
    updateChips();
  }

  function updateChips() {
    // Starters are for the first question; after that the conversation speaks for itself.
    const asked = history.some((t) => t.role === 'user');
    chipsEl?.toggleAttribute('hidden', asked || (mode === 'call' && !inCall));
  }

  function bubble(kind: 'agent' | 'you' | 'note', text = '', pending = false) {
    const li = document.createElement('li');
    li.className = kind + (pending ? ' pending' : '');
    if (kind !== 'note') {
      logEl.querySelector('li.current')?.classList.remove('current');
      li.classList.add('current');
      li.dataset.who = kind;
    }
    setText(li, text);
    logEl.append(li);
    logEl.scrollTop = logEl.scrollHeight;
    return li;
  }
  function setText(li: HTMLElement, text: string) {
    // On a call the caption box shows the newest lines of a long reply, like a
    // phone's live captions; the wrapper is what lets the start scroll away.
    const cap = document.createElement('span');
    cap.className = 'cap';
    const words = document.createElement('span');
    words.textContent = text;
    cap.append(words);
    li.replaceChildren(cap);
    li.classList.remove('hearing');
    li.dir = isUrdu(text) ? 'rtl' : 'auto';
    logEl.scrollTop = logEl.scrollHeight;
    // Overflow at the top isn't scrollable, so it doesn't show in scrollHeight: measure the words.
    requestAnimationFrame(() => cap.classList.toggle('over', words.offsetHeight > cap.clientHeight + 2));
  }
  const say = (text: string) => bubble('agent', text);
  const note = (text: string) => bubble('note', text);
  function typing() {
    const li = bubble('agent');
    li.classList.add('typing');
    li.innerHTML = '<span class="vcall-dots" aria-label="typing"><i></i><i></i><i></i></span>';
    return li;
  }

  function setAgent(next: Who) {
    gender = next;
    paintLabels();
  }

  /** Every fixed word on the panel, in the current language and for the current agent. */
  function paintLabels() {
    const t = ui();
    const other: Who = gender === 'female' ? 'male' : 'female';
    modal!.dataset.lang = lang;
    if (welcomeLi?.isConnected && !history.some((t) => t.role === 'user')) setText(welcomeLi, t.hello(shown()));
    if (nameEl) nameEl.textContent = shown();
    if (subtitleEl) subtitleEl.textContent = t.subtitle(gender);
    if (monoEl) monoEl.textContent = shown()[0];
    if (voiceTier) setVoiceTag(voiceTier);
    modal!.style.setProperty('--you', JSON.stringify(lang === 'ur' ? 'آپ' : 'You'));
    modal!.style.setProperty('--agent', JSON.stringify(shown()));
    const label = (sel: string, text: string) => {
      const el = modal!.querySelector(sel);
      if (el) el.textContent = text;
    };
    label('.vcall-tab[data-mode="call"] span', t.call);
    label('.vcall-tab[data-mode="message"] span', t.message);
    label('#vc-dial > span', t.dial(shown()));
    label('#vc-voice-switch > span', t.talkTo(shown(other)));
    label('#voice-keypad-toggle span', t.type);
    label('#voice-hangup-btn span', t.end);
    label('#voice-unblock-btn', t.tryMic);
    label('#voice-type-mode-btn', t.msgInstead);
    if (chipsEl) {
      chipsEl.dir = lang === 'ur' ? 'rtl' : 'ltr';
      chipsEl.replaceChildren(
        ...t.chips.map(([prompt, text]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'voice-chip';
          b.dataset.prompt = prompt;
          b.textContent = text;
          return b;
        }),
      );
    }
  }

  let voiceTier: 'live' | 'studio' | 'natural' | 'device' | null = null;
  function setVoiceTag(tier: 'live' | 'studio' | 'natural' | 'device' | null) {
    voiceTier = tier;
    if (!voiceTagEl) return;
    voiceTagEl.hidden = !tier;
    if (!tier) return;
    voiceTagEl.dataset.tier = tier === 'live' || tier === 'studio' ? 'studio' : tier;
    voiceTagEl.textContent = (lang === 'ur'
      ? { live: 'لائیو آواز', studio: 'اسٹوڈیو آواز', natural: 'قدرتی آواز', device: 'ڈیوائس کی آواز' }
      : { live: 'Live voice', studio: 'Studio voice', natural: 'Natural voice', device: 'Device voice' })[tier];
  }

  function updateHours() {
    const s = getCafeOpeningStatus();
    if (hoursLabel) hoursLabel.textContent = cafeHoursStatusLabel(s, lang);
    if (hoursEl) {
      hoursEl.dataset.state = s.isOpen ? (s.isSeatingOpen ? 'open' : 'late') : 'closed';
      hoursEl.dir = lang === 'ur' ? 'rtl' : 'ltr';
    }
  }

  function setLang(next: 'en' | 'ur') {
    lang = next;
    if (langBtn) {
      langBtn.dataset.lang = next;
      langBtn.setAttribute('aria-label', next === 'ur' ? 'Speaking Urdu. Switch to English' : 'Speaking English. Switch to Urdu');
    }
    if (textInput) {
      textInput.dir = next === 'ur' ? 'rtl' : 'auto';
      textInput.placeholder = UI[next].placeholder;
    }
    updateHours();
    paintLabels();
    setPhase(phase);
  }

  function showAlert(text: string | null) {
    if (!alertEl) return;
    alertEl.hidden = !text;
    if (text && alertText) alertText.textContent = text;
  }

  /* ═════════ sound ═════════ */

  function ensureAudio() {
    if (!ctx || ctx.state === 'closed') {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx();
      outGain = ctx.createGain();
      outAnalyser = ctx.createAnalyser();
      outAnalyser.fftSize = 1024;
      outGain.connect(outAnalyser);
      outAnalyser.connect(ctx.destination);
      ctx.onstatechange = wakeAudio;
      player = null;
      playerRouted = false;
    }
    // Must happen inside the tap that opened the call, or browsers keep it silent.
    ctx.resume().catch(() => {});
    return ctx;
  }

  /** The ringback the caller hears: 400 + 450 Hz, ring-ring, pause — the sound of a phone ringing out. */
  function ringback() {
    const c = ensureAudio();
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(c.destination);
    const oscs = [400, 450].map((f) => {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    const cycle = (t: number) => {
      const g = gain.gain;
      for (const [on, off] of [[0, 0.4], [0.6, 1.0]]) {
        g.setValueAtTime(0, t + on);
        g.linearRampToValueAtTime(0.07, t + on + 0.02);
        g.setValueAtTime(0.07, t + off - 0.02);
        g.linearRampToValueAtTime(0, t + off);
      }
    };
    let next = c.currentTime + 0.05;
    cycle(next);
    const iv = setInterval(() => {
      next += 3;
      cycle(next);
    }, 3000);
    return () => {
      clearInterval(iv);
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(0, c.currentTime);
      for (const o of oscs) {
        try {
          o.stop(c.currentTime + 0.05);
        } catch {}
      }
      setTimeout(() => gain.disconnect(), 120);
    };
  }

  /** The soft click of a handset being picked up, or the falling tone of a hang-up. */
  function blip(kind: 'pickup' | 'hangup') {
    try {
      const c = ensureAudio();
      const o = c.createOscillator();
      const g = c.createGain();
      const t = c.currentTime;
      o.frequency.setValueAtTime(kind === 'pickup' ? 660 : 420, t);
      o.frequency.exponentialRampToValueAtTime(kind === 'pickup' ? 990 : 150, t + 0.14);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.18);
    } catch {}
  }

  async function getMic() {
    if (micStream?.getAudioTracks().every((t) => t.readyState === 'live')) return micStream;
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No microphone API'), { name: 'NotSupportedError' });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    micStream = stream;
    const c = ensureAudio();
    micAnalyser = c.createAnalyser();
    micAnalyser.fftSize = 1024;
    c.createMediaStreamSource(stream).connect(micAnalyser);
    // A headset unplugged or a Bluetooth earbud gone flat ends the track: pick up whatever mic is left.
    for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => micStream === stream && void recoverMic(), { once: true });
    return stream;
  }

  async function recoverMic() {
    if (!inCall) return;
    micStream = null;
    try {
      const stream = await getMic();
      if (!inCall) return;
      if (engine === 'live' && live) await live.swapMic(stream);
      else if (phase === 'listening') stepsListen();
      note(ui().micBack);
    } catch {
      showAlert(ui().micMissing);
    }
  }

  /* A phone that locks, or a call coming in, can pause the page's audio; wake it when the caller is back. */
  function wakeAudio() {
    if (inCall && ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  }

  function releaseMic() {
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    micAnalyser = null;
  }

  /* One loop drives everything that follows sound: the orb, who's talking on
     the live line, and on the step-by-step line when you start and stop. */
  function loop() {
    raf = requestAnimationFrame(loop);
    let target = 0;
    const mic = micAnalyser && !muted ? rms(micAnalyser, micBuf) : 0;
    if (phase === 'speaking' && outAnalyser) target = Math.min(1, rms(outAnalyser, outBuf) * 5);
    else if ((phase === 'listening' || phase === 'thinking') && mic) target = Math.min(1, mic * 9);
    level = level * 0.65 + target * 0.35;
    modal!.style.setProperty('--lvl', level.toFixed(3));

    if (!inCall) return;
    if (engine === 'live' && live) {
      if (reconnecting) return;
      // Gemini is about to recycle the line: swap while nobody is mid-sentence.
      if (recycleDue && !live.speaking && liveTurnDone && !userBuf.trim()) return void reconnectLive('recycle');
      // Talking over Sarah stops her at once. Gemini notices too, but while she's
      // talking its signal reached us seconds late in testing; the mic level doesn't.
      // (Echo cancellation keeps her own voice far below this.)
      const now = performance.now();
      const loud = !muted && mic > Math.max(LIVE_BARGE_LEVEL, liveFloor * 6);
      if (loud) {
        lastVoiceAt = now;
        liveLoudSince ||= now;
        if (live.speaking && now - liveLoudSince > LIVE_BARGE_MS) {
          liveLoudSince = 0;
          return cutAgentOff();
        }
        // Between turns the same sound puts up "You …", so the caller sees they're heard.
        if (!live.speaking && phase === 'listening' && now - liveLoudSince > 200) hearCaller();
      } else {
        liveLoudSince = 0;
        if (!live.speaking && mic && !userBuf) liveFloor = liveFloor * 0.98 + Math.min(mic, 0.02) * 0.02;
      }
      if (userLi && now - hearingSince > 5000 && now - lastVoiceAt > 4000) forgetHearing();
      if (live.speaking) {
        if (phase !== 'speaking') setPhase('speaking');
      } else if (phase === 'speaking') {
        if (hangUpAfterSpeech && liveTurnDone) endCall();
        else setPhase(muted ? 'muted' : 'listening');
      }
    } else if (engine === 'steps') stepsListenTick(mic);
  }

  /* ═════════ the call ═════════ */

  async function startCall() {
    if (inCall) return;
    inCall = true;
    const seq = ++callSeq;
    callId = uuid();
    muted = false;
    hangUpAfterSpeech = false;
    liveTurnDone = true;
    reconnecting = recycleDue = false;
    showAlert(null);
    setVoiceTag(null);
    setMode('call');
    updateChips();
    ensureAudio();
    triggerHaptic?.(30);
    setPhase('ringing');
    stopRing = ringback();
    const ringStarted = performance.now();
    const ringMs = ringFor();

    const recap = history.slice(-12).map((t) => `${t.role === 'user' ? 'Caller' : agent()}: ${t.content}`).join('\n');
    const lineP = fetch('/api/voice/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId, gender, lang, recap }) })
      .then((r) => r.json())
      .catch(() => ({ live: false }));

    let mic: MediaStream | null = null;
    try {
      mic = await getMic();
    } catch (err: any) {
      if (seq !== callSeq) return;
      stopRing?.();
      stopRing = null;
      inCall = false;
      const blocked = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      showAlert(blocked ? ui().micBlocked : ui().micMissing);
      setPhase('ended', ui().noConnect);
      updateChips();
      return;
    }

    // Connect the live line while it rings; if it can't, the step-by-step line takes the call.
    let chosen: Engine = 'steps';
    const line = await lineP;
    if (seq !== callSeq) return;
    if (line?.live && line.url) {
      const session = new LiveSession(ensureAudio(), outGain!, onLive);
      session.beat = humanBeat;
      try {
        await session.connect(line.url, line.setup);
        live = session;
        chosen = 'live';
      } catch (err) {
        console.warn('[brewns-call] live line unavailable, using step-by-step voice:', err);
        session.close();
      }
    }
    const wait = ringMs - (performance.now() - ringStarted);
    if (wait > 0) await sleep(wait);
    if (seq !== callSeq) {
      live?.close();
      live = null;
      return;
    }

    // Picked up.
    stopRing?.();
    stopRing = null;
    blip('pickup');
    triggerHaptic?.(40);
    engine = chosen;
    seconds = 0;
    if (timerEl) {
      timerEl.hidden = false;
      timerEl.textContent = '00:00';
    }
    clearInterval(timer);
    timer = setInterval(() => {
      seconds++;
      if (timerEl) timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
    note(ui().pickedUp(shown()));
    updateChips();

    if (engine === 'live' && live) {
      setVoiceTag('live');
      setPhase('thinking', ui().connected);
      await live.startMic(mic);
      live.sendText(PICKUP_CUE);
    } else {
      const id = ++turnId;
      setPhase('thinking', ui().connected);
      const data = await ask('call_init').catch(() => null);
      if (id !== turnId || seq !== callSeq) return;
      const hello = data?.reply || (lang === 'ur' ? `السلام علیکم، brewns سے ${agent()} بات کر رہی ہوں۔ میں آپ کی کیا مدد کر سکتی ہوں؟` : `Hi, thanks for calling brewns, this is ${agent()}. How can I help?`);
      history.push({ role: 'assistant', content: hello });
      await speakReply(hello, data?.audioChunks, id);
    }
  }

  function endCall(how: 'hangup' | 'dropped' | 'switch' = 'hangup') {
    if (!inCall) return;
    inCall = false;
    reconnecting = recycleDue = false;
    callSeq++;
    turnId++;
    stopRing?.();
    stopRing = null;
    if (live) {
      commitLiveTurn();
      live.close();
      live = null;
    }
    stopRecorder(false);
    stopSpeaking();
    releaseMic();
    clearInterval(timer);
    if (timerEl) timerEl.hidden = true;
    fetch('/api/voice/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'call_end', callId }), keepalive: true }).catch(() => {});
    const length = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (seconds > 0) note(how === 'dropped' ? ui().dropped(length) : ui().callEnded(length));
    seconds = 0;
    callId = uuid();
    if (how !== 'switch') blip('hangup');
    setPhase('ended');
    updateChips();
  }

  /* ── the live line ── */

  function onLive(e: LiveEvent) {
    if (e.type === 'user-text') {
      userBuf += e.text;
      if (!userLi) userLi = bubble('you', '', true);
      const heard = toUrduScript(userBuf.trim());
      setText(userLi, heard);
      if (!heard) return;
      if (isUrdu(heard) && lang !== 'ur') setLang('ur');
      liveTurnDone = false;
    } else if (e.type === 'agent-text') {
      agentBuf += e.text;
      if (!agentLi) agentLi = bubble('agent');
      const said = toUrduScript(agentBuf.trim());
      setText(agentLi, said);
      if (isUrdu(said) && lang !== 'ur') setLang('ur');
      liveTurnDone = false;
    } else if (e.type === 'caller-start') {
      // The caller started talking: Sarah stops now, not when her queued words run out.
      if (live?.speaking) cutAgentOff();
      else if (!muted) hearCaller();
    } else if (e.type === 'interrupted') {
      cutAgentOff();
    } else if (e.type === 'turn-complete') {
      commitLiveTurn();
      liveTurnDone = true;
    } else if (e.type === 'tool-call') {
      void runLiveTools(e.calls);
    } else if (e.type === 'go-away') {
      recycleDue = true;
      if (e.ms < 4000) void reconnectLive('recycle');
    } else if (e.type === 'closed') {
      if (inCall) void reconnectLive('dropped');
    }
  }

  /** The caller talked over Sarah: her voice stops mid-word and her line ends in "…".
      Her words arrive ahead of her voice, so the line is cut back to about as far
      as she actually got, and that's what the conversation remembers she said.
      What the caller is saying stays open; it's still being heard. */
  function cutAgentOff() {
    const played = live?.hush() ?? 1;
    const words = agentBuf.trim().split(/\s+/).filter(Boolean);
    if (words.length && played < 1) agentBuf = words.slice(0, Math.max(1, Math.ceil(words.length * played))).join(' ');
    if (agentLi && agentBuf.trim()) setText(agentLi, `${toUrduScript(agentBuf.trim())} …`);
    commitLiveTurn('agent');
    if (!reconnecting) {
      setPhase(muted ? 'muted' : 'listening');
      if (!muted) hearCaller();
    }
  }

  /** The caller is talking: show "You …" straight away, before Gemini's words for it arrive. */
  function hearCaller() {
    if (userLi || reconnecting) return;
    userLi = bubble('you', '', true);
    userLi.classList.add('hearing');
    hearingSince = performance.now();
  }

  /** A "You …" that never got any words (a cough, a door): put the last line back. */
  function forgetHearing() {
    if (!userLi || userBuf.trim() || !userLi.classList.contains('hearing')) return;
    userLi.remove();
    userLi = null;
    const last = [...logEl.querySelectorAll<HTMLLIElement>('li:not(.note)')].at(-1);
    last?.classList.add('current');
  }

  function commitLiveTurn(only?: 'agent') {
    if (!only) forgetHearing();
    const raw = only ? '' : userBuf.trim();
    const caller = toUrduScript(raw);
    const said = toUrduScript(agentBuf.trim());
    const li = userLi;
    if (caller) {
      li?.classList.remove('pending');
      const turn: Turn = { role: 'user', content: caller };
      history.push(turn);
      lastCaller = caller;
      // The caption already reads as Urdu letter by letter; swap in properly spelled Urdu when it's back.
      if (hasDevanagari(raw) || (lang === 'ur' && !isUrdu(raw) && romanUrdu(raw))) void tidyUrdu(raw, li, turn);
    }
    if (said) {
      history.push({ role: 'assistant', content: said });
      lastAgent = said;
    }
    if (caller || said) {
      fetch('/api/voice/live/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId, caller, agent: said, gender, lang }) }).catch(() => {});
    }
    agentBuf = '';
    agentLi = null;
    if (!only) {
      userBuf = '';
      userLi = null;
    }
    updateChips();
  }

  /** A Gemini Live token for this call; `resume` carries a dropped conversation over to the new line. */
  function openLine(resume = '') {
    const recap = history.slice(-12).map((t) => `${t.role === 'user' ? 'Caller' : agent()}: ${t.content}`).join('\n');
    return fetch('/api/voice/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId, gender, lang, recap, resume }) })
      .then((r) => r.json())
      .catch(() => ({ live: false }));
  }

  /** Back online, or a few seconds gone by: whichever comes first. */
  const waitOnline = (ms: number) =>
    navigator.onLine ? Promise.resolve() : new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      window.addEventListener('online', () => (clearTimeout(t), r()), { once: true });
    });

  /* The line dropped (a train, a lift, wifi to 4G), or Gemini is recycling it:
     carry the same conversation over to a new connection. With Gemini's
     resumption handle it continues mid-thought; without one, Sarah gets the
     conversation so far and picks up from it. The mic and speakers never stop.
     Three tries, then the step-by-step line takes over: the call never just ends. */
  async function reconnectLive(why: 'dropped' | 'recycle') {
    const session = live;
    if (!session || reconnecting || !inCall) return;
    reconnecting = true;
    recycleDue = false;
    const seq = callSeq;
    const dropped = why === 'dropped';
    if (dropped) {
      cutAgentOff();
      commitLiveTurn();
      setPhase('connecting', ui().reconnecting);
    }
    const stale = () => seq !== callSeq || live !== session;
    const attempt = async (): Promise<'ok' | 'stale' | 'failed'> => {
      for (let i = 0; i < 3; i++) {
        if (i) await sleep(i === 1 ? 800 : 2500);
        await waitOnline(8000);
        if (stale()) return 'stale';
        const resume = session.resumeHandle;
        const line = await openLine(resume);
        if (stale()) return 'stale';
        if (!line?.live || !line.url) continue;
        try {
          await session.connect(line.url, line.setup);
          if (stale()) return 'stale';
          if (!resume) session.sendText('The phone line dropped for a moment and is back now. In a few words, say you can hear the caller again, then carry on from where the conversation was.');
          return 'ok';
        } catch (err) {
          console.warn('[brewns-call] reconnect failed:', err);
        }
      }
      return 'failed';
    };
    const result = await attempt();
    reconnecting = false;
    if (result === 'stale') return;
    if (result === 'ok') {
      if (dropped) {
        note(ui().reconnected);
        // On the call screen only the status line shows it; the next phase change clears it.
        setPhase(muted ? 'muted' : 'listening', muted ? undefined : ui().reconnected);
      }
      return;
    }
    // The live line is gone for now: the step-by-step line carries on with the same conversation.
    session.close();
    live = null;
    engine = 'steps';
    setVoiceTag(null);
    note(ui().fellBack);
    const id = ++turnId;
    setPhase('thinking');
    const data = await ask('line_resume').catch(() => null);
    if (id === turnId && seq === callSeq) await speakReply(data?.reply || 'Sorry about that, the line broke up for a second. Where were we?', data?.audioChunks, id);
  }

  async function tidyUrdu(raw: string, li: HTMLLIElement | null, turn: Turn) {
    try {
      const r = await fetch('/api/voice/urdu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: raw }) });
      const { text } = await r.json();
      if (!text || !isUrdu(text)) return;
      if (li?.isConnected) setText(li, text);
      if (lastCaller === turn.content) lastCaller = text;
      turn.content = text;
    } catch {}
  }

  async function runLiveTools(calls: { id: string; name: string; args: Record<string, unknown> }[]) {
    setPhase('thinking');
    // The words the caller just said can trail the tool call by a beat; the booking check needs their "yes".
    for (let i = 0; i < 8 && !userBuf.trim(); i++) await sleep(80);
    const transcript = toUrduScript(userBuf.trim()) || lastCaller;
    const seq = callSeq;
    const responses = await Promise.all(
      calls.map(async (c) => {
        try {
          const r = await fetch('/api/voice/live/tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId, name: c.name, args: c.args, transcript, previousAssistant: lastAgent, gender, lang }),
            // A hung request would leave Sarah silent on the line; she apologises instead.
            signal: AbortSignal.timeout(15000),
          });
          const d = await r.json();
          if (seq === callSeq) for (const a of (d.actions || []) as Action[]) handleAction(a);
          return { id: c.id, name: c.name, response: d.output ?? { error: d.error || 'The system did not answer.' } };
        } catch {
          return { id: c.id, name: c.name, response: { error: 'The booking system did not respond. Apologise and offer to try again.' } };
        }
      }),
    );
    if (seq !== callSeq) return;
    live?.sendToolResponses(responses);
    // "One moment…" shouldn't outstay the moment if the answer comes back without words.
    setTimeout(() => {
      if (seq === callSeq && engine === 'live' && phase === 'thinking' && !reconnecting && !live?.speaking) setPhase(muted ? 'muted' : 'listening');
    }, 6000);
  }

  /* ── the step-by-step line (when the live line isn't available) ── */

  async function ask(message: string, channel: 'voice' | 'text' = 'voice') {
    const res = await fetch('/api/voice/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, gender, history, state: scriptState, lang, callId, channel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The line is busy (${res.status})`);
    scriptState = data.state || {};
    if ((data.lang === 'ur' || data.lang === 'en') && data.lang !== lang) setLang(data.lang);
    return data as { reply: string; audioChunks?: AudioChunk[]; audioUrl?: string; actions?: Action[] };
  }

  /** Something the caller said or typed on the step-by-step line. */
  async function stepsTurn(said: string) {
    const id = ++turnId;
    const seq = callSeq;
    stopRecorder(false);
    stopSpeaking();
    setPhase('thinking');
    try {
      const data = await ask(said);
      if (id !== turnId || seq !== callSeq) return;
      history.push({ role: 'user', content: said }, { role: 'assistant', content: data.reply });
      updateChips();
      for (const a of data.actions || []) handleAction(a);
      await speakReply(data.reply, data.audioChunks ?? (data.audioUrl ? [{ text: data.reply, url: data.audioUrl }] : undefined), id);
    } catch (err) {
      if (id !== turnId || seq !== callSeq) return;
      const sorry = err instanceof Error && /busy/i.test(err.message) ? err.message : 'Sorry, the line broke up for a second. Could you say that again?';
      await speakReply(sorry, undefined, id);
    }
  }

  async function fetchVoice(url: string) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return { blob: await r.blob(), tier: (r.headers.get('X-Voice') as 'studio' | 'natural') || 'natural' };
    } catch {
      return null;
    }
  }

  /** Say a reply a chunk at a time; the next chunk's voice is fetched while this one plays. */
  async function speakReply(reply: string, audio: AudioChunk[] | undefined, id: number) {
    const parts: AudioChunk[] = audio?.length ? audio : [{ text: reply, url: '' }];
    const li = bubble('agent');
    let shown = '';
    let next = parts[0].url ? fetchVoice(parts[0].url) : Promise.resolve(null);
    setPhase('speaking');
    // While her voice is still loading nothing is playing, so a caller who starts
    // talking is heard (after a beat, so their own last word doesn't count) rather
    // than lost: before, anything said in those seconds went nowhere.
    vad.armedAt = performance.now() + 400;
    vad.loudSince = 0;
    for (let i = 0; i < parts.length; i++) {
      // The words appear as they are about to be said, not after the audio arrives.
      shown = `${shown} ${parts[i].text}`.trim();
      setText(li, shown);
      const voice = await next;
      if (id !== turnId) return;
      next = parts[i + 1]?.url ? fetchVoice(parts[i + 1].url) : Promise.resolve(null);
      vad.armedAt = performance.now() + 450;
      setVoiceTag(voice ? voice.tier : 'device');
      if (voice) await playBlob(voice.blob, id);
      else await speakWithDevice(parts[i].text, id);
      if (id !== turnId) return;
    }
    if (shown !== reply && !audio?.length) setText(li, reply);
    if (hangUpAfterSpeech) return void setTimeout(() => inCall && endCall(), 300);
    stepsListen();
  }

  function playBlob(blob: Blob, id: number) {
    return new Promise<void>((resolve) => {
      if (!player) {
        player = new Audio();
        player.setAttribute('playsinline', '');
      }
      // Route the voice through the level meter once the context is running; a
      // suspended context would otherwise swallow the sound entirely.
      if (!playerRouted && ctx && ctx.state === 'running' && outGain) {
        try {
          ctx.createMediaElementSource(player).connect(outGain);
          playerRouted = true;
        } catch {}
      }
      const url = URL.createObjectURL(blob);
      const done = () => {
        URL.revokeObjectURL(url);
        if (player) player.onended = player.onerror = null;
        resolve();
      };
      player.onended = done;
      player.onerror = done;
      player.src = url;
      player.play().catch(done);
      const watch = setInterval(() => {
        if (id !== turnId) {
          clearInterval(watch);
          player?.pause();
          done();
        } else if (!player || player.ended || player.paused) clearInterval(watch);
      }, 100);
    });
  }

  function speakWithDevice(text: string, id: number) {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) return void setTimeout(resolve, Math.min(6000, 400 + text.length * 50));
      const voices = speechSynthesis.getVoices();
      const urdu = isUrdu(text);
      // The best voice the device has: the natural/neural ones sound far less robotic.
      const v = urdu
        ? voices.find((x) => /^ur/i.test(x.lang))
        : voices.find((x) => /^en/i.test(x.lang) && /natural|neural|online/i.test(x.name) && (gender === 'female' ? !/\bmale\b|guy|ryan|davis/i.test(x.name) : /\bmale\b|guy|ryan|davis|christopher/i.test(x.name))) ||
          voices.find((x) => /^en-(GB|US|IN)/i.test(x.lang) && /google|samantha|daniel|aria|jenny|sonia/i.test(x.name)) ||
          voices.find((x) => /^en/i.test(x.lang));
      if (urdu && !v) return void setTimeout(resolve, Math.min(7000, 600 + text.length * 60));
      const u = new SpeechSynthesisUtterance(text);
      if (v) u.voice = v;
      u.lang = v?.lang || (urdu ? 'ur-PK' : 'en-GB');
      u.rate = 1.02;
      u.onend = u.onerror = () => resolve();
      utterance = u;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      const watch = setInterval(() => {
        if (id !== turnId) {
          speechSynthesis.cancel();
          clearInterval(watch);
          resolve();
        } else if (!speechSynthesis.speaking) clearInterval(watch);
      }, 100);
    });
  }

  function stopSpeaking() {
    if (player) {
      player.pause();
      player.removeAttribute('src');
    }
    if (utterance) {
      utterance = null;
      try {
        speechSynthesis.cancel();
      } catch {}
    }
  }

  function stepsListen() {
    if (!inCall || engine !== 'steps') return;
    if (muted || !micStream) return setPhase('muted');
    stopRecorder(false);
    chunks = [];
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
    try {
      recorder = type ? new MediaRecorder(micStream, { mimeType: type }) : new MediaRecorder(micStream);
    } catch {
      showAlert('This browser can’t record from the microphone. Keep going by message instead.');
      return setPhase('muted');
    }
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start(250);
    Object.assign(vad, { talking: false, since: 0, quietSince: 0, startedAt: performance.now() });
    setPhase('listening');
  }

  /** Called every frame on the step-by-step line: when did the caller start and stop talking? */
  function stepsListenTick(mic: number) {
    const now = performance.now();
    if (phase === 'speaking') {
      // Talking over the voice stops it, like on a real call.
      if (now < vad.armedAt || muted) return;
      if (mic > Math.max(LIVE_BARGE_LEVEL, vad.floor * 6)) {
        vad.loudSince ||= now;
        if (now - vad.loudSince > BARGE_IN_MS) {
          turnId++;
          stopSpeaking();
          stepsListen();
        }
      } else vad.loudSince = 0;
      return;
    }
    if (phase !== 'listening' || !recorder) return;
    const threshold = Math.max(0.012, vad.floor * 3);
    if (mic > threshold) {
      vad.since ||= now;
      vad.quietSince = 0;
      if (!vad.talking && now - vad.since > SPEECH_START_MS) {
        vad.talking = true;
        vad.startedAt = now;
      }
    } else {
      if (!vad.talking) {
        vad.since = 0;
        vad.floor = vad.floor * 0.97 + mic * 0.03;
      } else {
        vad.quietSince ||= now;
        if (now - vad.quietSince > SPEECH_END_MS) return void stopRecorder(true);
      }
    }
    if (vad.talking && now - vad.startedAt > SPEECH_MAX_MS) return void stopRecorder(true);
    // Nothing said for a while: start a fresh recording so it doesn't grow forever.
    if (!vad.talking && now - vad.startedAt > 25000) stepsListen();
  }

  function stopRecorder(send: boolean) {
    const r = recorder;
    recorder = null;
    if (!r || r.state === 'inactive') return;
    const seq = callSeq;
    r.onstop = async () => {
      if (!send || seq !== callSeq || !inCall) return;
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      chunks = [];
      if (blob.size < 1500) return stepsListen();
      setPhase('thinking');
      const li = bubble('you', '…', true);
      try {
        const form = new FormData();
        form.append('file', blob, `voice.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
        form.append('language', lang);
        form.append('callId', callId);
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        const text = String(data.text || '').trim();
        if (seq !== callSeq) return;
        if (!res.ok || !text || PHANTOM.test(text)) {
          li.remove();
          return stepsListen();
        }
        li.classList.remove('pending');
        setText(li, text);
        void stepsTurn(text);
      } catch {
        li.remove();
        stepsListen();
      }
    };
    try {
      r.stop();
    } catch {}
  }

  /* ═════════ messages ═════════ */

  async function sendMessage(text: string) {
    const said = text.trim();
    if (!said) return;
    if (textInput) textInput.value = '';
    playSoftClick?.();
    showAlert(null);

    if (mode === 'call' && inCall) {
      // Typed during a call: the person on the line answers it out loud.
      bubble('you', said);
      if (engine === 'live' && live) {
        commitLiveTurn();
        userBuf = said;
        live.sendText(said);
        lastCaller = said;
      } else void stepsTurn(said);
      return;
    }
    if (mode === 'call') setMode('message');
    if (isUrdu(said) && lang !== 'ur') setLang('ur');

    bubble('you', said);
    const dots = typing();
    setPhase('thinking', gendered(ui().typing(shown())));
    try {
      const data = await ask(said, 'text');
      history.push({ role: 'user', content: said }, { role: 'assistant', content: data.reply });
      dots.classList.remove('typing');
      setText(dots, data.reply);
      for (const a of data.actions || []) if (a.type !== 'END_CALL') handleAction(a);
    } catch (err) {
      setText(dots, err instanceof Error && /busy/i.test(err.message) ? err.message : 'Sorry, that didn’t send. Try again in a moment.');
      dots.classList.remove('typing');
    }
    updateChips();
    setPhase('idle');
  }

  /* ═════════ what the conversation does ═════════ */

  function handleAction(action: Action) {
    if (action.type === 'ADD_TO_BAG') {
      let added = 0;
      for (const line of action.data?.items || []) {
        const p = productById(line.id);
        if (!p) continue;
        try {
          cart.add(line.id, line.sel || defaultSel(p), line.qty || 1);
          added += line.qty || 1;
        } catch (e) {
          console.warn('Could not add product to cart:', line.id, e);
        }
      }
      if (added) {
        playChime?.();
        triggerHaptic?.(40);
        toast(`ADDED ${added} ITEM${added > 1 ? 'S' : ''} TO YOUR BAG`, 'VIEW BAG', () => {
          closeModal();
          openBag();
        });
      }
    } else if (action.type === 'RESERVE_TABLE') {
      playChime?.();
      triggerHaptic?.(50);
      toast(`TABLE BOOKED · ${action.data?.code || 'CONFIRMED'}`);
    } else if (action.type === 'BOOK_PARTY') {
      playChime?.();
      triggerHaptic?.(50);
      toast(`PARTY BOOKED · ${action.data?.code || 'CONFIRMED'} · WE'LL CALL YOU`);
    } else if (action.type === 'WHATSAPP_VOUCHER') {
      toast(`${action.data?.sent ? 'WHATSAPP VOUCHER SENT' : 'WHATSAPP VOUCHER READY'} · ${action.data?.code || ''}`, 'OPEN WHATSAPP', () => {
        if (action.data?.whatsappUrl) window.open(action.data.whatsappUrl, '_blank', 'noopener,noreferrer');
      });
    } else if (action.type === 'CALLBACK') {
      triggerHaptic?.(40);
      toast(lang === 'ur' ? 'ٹیم آپ کو واپس کال کرے گی' : `WE'LL CALL YOU BACK · ${action.data?.phone || ''}`);
    } else if (action.type === 'END_CALL') {
      hangUpAfterSpeech = true;
    }
  }

  /* ═════════ open, close, switch ═════════ */

  function openModal(next: Mode) {
    modal!.hidden = false;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    setAgent(gender);
    setLang(lang);
    updateHours();
    clearInterval(hoursTimer);
    hoursTimer = setInterval(updateHours, 30_000);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    setMode(next);
    if (next === 'call') void startCall();
  }

  function closeModal() {
    endCall();
    stopSpeaking();
    cancelAnimationFrame(raf);
    clearInterval(hoursTimer);
    modal!.hidden = true;
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    try {
      ctx?.close().catch(() => {});
    } catch {}
    ctx = null;
    setPhase('idle');
  }

  async function transferTo(next: 'female' | 'male') {
    if (!inCall || engine !== 'live') {
      setAgent(next);
      if (inCall) {
        const id = ++turnId;
        stopRecorder(false);
        stopSpeaking();
        setPhase('thinking');
        const data = await ask('voice_switch').catch(() => null);
        if (id !== turnId) return;
        await speakReply(data?.reply || `Hi, ${agent()} here. Where were we?`, data?.audioChunks, id);
      }
      return;
    }
    // A live voice is fixed for its session: hand the call to a new line with the conversation so far.
    const from = agent();
    commitLiveTurn();
    live?.close();
    live = null;
    setAgent(next);
    setPhase('connecting', ui().transferring(shown()));
    note(ui().transferred(shown()));
    const seq = callSeq;
    const recap = history.slice(-12).map((t) => `${t.role === 'user' ? 'Caller' : from}: ${t.content}`).join('\n');
    const line = await fetch('/api/voice/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId, gender, lang, recap }) })
      .then((r) => r.json())
      .catch(() => ({ live: false }));
    if (seq !== callSeq) return;
    if (line?.live) {
      const session = new LiveSession(ensureAudio(), outGain!, onLive);
      session.beat = humanBeat;
      try {
        await session.connect(line.url, line.setup);
        if (seq !== callSeq) return session.close();
        live = session;
        await live.startMic(micStream!);
        live.setMuted(muted);
        live.sendText(`The caller was just transferred to you from ${from}. Introduce yourself in one short sentence and carry on from where the conversation was.`);
        return;
      } catch {
        session.close();
      }
    }
    engine = 'steps';
    setVoiceTag(null);
    const id = ++turnId;
    const data = await ask('voice_switch').catch(() => null);
    if (id === turnId) await speakReply(data?.reply || `Hi, ${agent()} here. Where were we?`, data?.audioChunks, id);
  }

  function toggleMute() {
    if (!inCall || phase === 'ringing') return;
    playSoftClick?.();
    triggerHaptic?.(20);
    muted = !muted;
    if (engine === 'live') live?.setMuted(muted);
    else if (muted) stopRecorder(false);
    if (muted) setPhase('muted');
    else if (engine === 'live') setPhase(live?.speaking ? 'speaking' : 'listening');
    else if (phase !== 'speaking' && phase !== 'thinking') stepsListen();
    else setPhase(phase);
  }

  /* ═════════ wiring ═════════ */

  const openCall = (e: Event) => {
    e.preventDefault();
    openModal('call');
  };
  for (const id of ['hdr-voice-btn', 'hero-call-btn', 'voice-call-float', 'menu-voice-call-link']) on($(id), 'click', openCall);
  for (const id of ['voice-call-close', 'voice-call-backdrop']) on($(id), 'click', (e: Event) => {
    e.preventDefault();
    closeModal();
  });
  on($('voice-hangup-btn'), 'click', (e: Event) => {
    e.preventDefault();
    endCall();
  });
  on($('vc-dial'), 'click', (e: Event) => {
    e.preventDefault();
    void startCall();
  });
  on(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !modal!.hidden) closeModal();
  });
  on(window, 'pagehide', () => inCall && endCall());
  on(document, 'visibilitychange', () => !document.hidden && wakeAudio());
  // Back online after a dead spot: don't wait for the old socket to time out.
  on(window, 'online', () => {
    if (inCall && engine === 'live' && live && !live.open) void reconnectLive('dropped');
  });

  for (const t of tabs)
    on(t, 'click', (e: Event) => {
      e.preventDefault();
      const next = t.dataset.mode as Mode;
      if (next === mode) return;
      playSoftClick?.();
      if (next === 'message' && inCall) endCall('switch');
      setMode(next);
    });

  on(micBtn, 'click', (e: Event) => {
    e.preventDefault();
    toggleMute();
  });
  on(keypadBtn, 'click', (e: Event) => {
    e.preventDefault();
    const open = !!inputRow?.classList.toggle('open');
    keypadBtn?.setAttribute('aria-expanded', String(open));
    if (open) textInput?.focus();
  });
  on($('vc-voice-switch'), 'click', (e: Event) => {
    e.preventDefault();
    playSoftClick?.();
    void transferTo(gender === 'female' ? 'male' : 'female');
  });
  on(langBtn, 'click', (e: Event) => {
    e.preventDefault();
    playSoftClick?.();
    setLang(lang === 'en' ? 'ur' : 'en');
    if (inCall && engine === 'live') live?.sendText(lang === 'ur' ? 'The caller would like to continue in Urdu.' : 'The caller would like to continue in English.');
  });
  on(inputRow, 'submit', (e: Event) => {
    e.preventDefault();
    void sendMessage(textInput?.value || '');
  });
  on(chipsEl, 'click', (e: Event) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.voice-chip');
    if (!chip?.dataset.prompt) return;
    e.preventDefault();
    void sendMessage(chip.dataset.prompt);
  });
  on($('voice-unblock-btn'), 'click', (e: Event) => {
    e.preventDefault();
    showAlert(null);
    void startCall();
  });
  on($('voice-type-mode-btn'), 'click', (e: Event) => {
    e.preventDefault();
    showAlert(null);
    setMode('message');
  });

  setAgent('female');
  setLang(lang);
  try {
    speechSynthesis.getVoices();
  } catch {}

  return () => {
    closeModal();
    ac.abort();
  };
}
