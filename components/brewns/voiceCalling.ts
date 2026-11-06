'use client';

import { hasDevanagari, toUrduScript } from '@/lib/devanagari';
import { cafeHoursStatusLabel, getCafeOpeningStatus } from '@/lib/openingHours';
import { emptySummary, noteAction, noteTool, summaryRows, type CallPurpose } from './callSummary';
import { LiveSession, type LiveEvent } from './liveSession';
import { showVoiceOrder } from './voiceOrderCard';

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
  /** An order Sarah placed on the call: keep it with the visitor's orders (live pill, tracker) and empty the bag. */
  onOrderPlaced?: (order: any, key: string) => void;
  /** Open the full tracking page for an order. */
  openTracking?: (number: number) => void;
}

type Mode = 'call' | 'message';
type Phase = 'idle' | 'ringing' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'muted' | 'ended';
type Turn = { role: 'user' | 'assistant'; content: string };
type Action = { type: string; data?: any };
type Engine = 'live' | 'steps';
type AudioChunk = { text: string; url: string };

/** Tools that need the caller's own "yes" before they run. */
const NEEDS_YES = new Set(['reserve_table', 'book_party', 'place_order']);
/** Tools that finish something, and get the ta-da. */
const DONE_SOUND = new Set(['reserve_table', 'book_party', 'place_order', 'add_to_bag', 'request_callback', 'save_booking_email']);

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
/** The caller's language choice, kept for their next call. */
const LANG_KEY = 'brewns-call-lang';
/** Silence this long when Sarah owes an answer means she isn't answering. */
const NO_ANSWER_MS = 12000;

type Lang = 'en' | 'ur';
type Who = 'female' | 'male';
const NAMES: Record<Lang, Record<Who, string>> = { en: { female: 'Sarah', male: 'Hamza' }, ur: { female: 'سارہ', male: 'حمزہ' } };
const UI = {
  en: {
    call: 'Call', message: 'Message', type: 'Type', end: 'End', mute: 'Mute', unmute: 'Unmute',
    talkTo: (n: string) => `Talk to ${n}`,
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
    why: 'What can we help with?', order: 'Place an order', complaint: 'Report a problem', back: 'Language', noted: (n: string) => `${n} has noted`,
    stepLanguage: 'Step 1 of 2', chooseLanguage: 'Choose your language', languageHelp: 'You can change this at any time.',
    stepPurpose: 'Step 2 of 2', purposeHelp: 'Choose a reason and Sarah will guide you, one step at a time.',
    orderDetail: 'Coffee, food, a table or a party', complaintDetail: 'Tell us what happened—we’ll help make it right',
    callNote: 'Speak naturally. Your conversation stays on screen, and we never ask for card details.',
    purpose: { order: 'I’d like to place an order.', complaint: 'I have a complaint.' },
    noAnswer: (n: string) => `${n} isn’t answering. The line may be slow; try again, or keep going by message.`, retry: 'Try again',
    offline: 'No internet · waiting for signal…',
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
    talkTo: (n: string) => `${n} سے بات کریں`,
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
    why: 'ہم آپ کی کیا مدد کر سکتے ہیں؟', order: 'آرڈر دینا ہے', complaint: 'مسئلہ رپورٹ کریں', back: 'زبان', noted: (n: string) => `${n} نے نوٹ کیا`,
    stepLanguage: '۲ میں سے مرحلہ ۱', chooseLanguage: 'اپنی زبان منتخب کریں', languageHelp: 'آپ اسے کسی بھی وقت بدل سکتے ہیں۔',
    stepPurpose: '۲ میں سے مرحلہ ۲', purposeHelp: 'ایک وجہ منتخب کریں؛ سارہ آپ کی ایک ایک قدم پر رہنمائی کرے گی۔',
    orderDetail: 'کافی، کھانا، ٹیبل یا پارٹی', complaintDetail: 'ہمیں بتائیں کیا ہوا، ہم اسے ٹھیک کرنے میں مدد کریں گے',
    callNote: 'آرام سے بات کریں۔ گفتگو اسکرین پر رہتی ہے اور ہم کبھی کارڈ کی تفصیل نہیں مانگتے۔',
    purpose: { order: 'مجھے آرڈر دینا ہے۔', complaint: 'مجھے ایک شکایت درج کرانی ہے۔' },
    noAnswer: (n: string) => `${n} جواب نہیں دے رہیں۔ لائن سست ہو سکتی ہے؛ دوبارہ کوشش کریں، یا پیغام سے بات جاری رکھیں۔`, retry: 'دوبارہ کوشش کریں',
    offline: 'انٹرنیٹ نہیں · سگنل کا انتظار…',
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

export function initVoiceCalling({ cart, productById, defaultSel, openBag, toast, playChime, playSoftClick, triggerHaptic, onOrderPlaced, openTracking }: VoiceCallingDeps) {
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
  const pickLang = $('vc-pick-lang');
  const pickWhy = $('vc-pick-why');
  let returnFocus: HTMLElement | null = null;
  const sumEl = $('vc-sum');
  const sumRows = $('vc-sum-rows');
  const tabs = [...modal.querySelectorAll<HTMLButtonElement>('.vcall-tab')];

  const ac = new AbortController();
  const on = (el: EventTarget | null, ev: string, fn: (e: any) => void) => el?.addEventListener(ev, fn, { signal: ac.signal });

  /* ── state ── */
  let mode: Mode = 'call';
  let phase: Phase = 'idle';
  let gender: 'female' | 'male' = 'female';
  let lang: 'en' | 'ur' = (() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'en' || saved === 'ur') return saved;
    } catch {}
    return /^ur/i.test(navigator.language) ? 'ur' : 'en';
  })();
  /** Chosen before dialling: an order or a complaint. */
  let purpose: CallPurpose = 'order';
  /** What Sarah has understood on this call, shown above the conversation. */
  let summary = emptySummary();
  /** Set while Sarah owes an answer: if it fires, she isn't answering. */
  let answerWatch = 0;
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
  /** An order placed on this call: when the call ends, its tracking page opens. */
  let placedThisCall: number | null = null;
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
  /** The clip playing through the AudioContext, so a barge-in or hang-up can stop it. */
  let clip: AudioBufferSourceNode | null = null;
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

  /** What she's doing while a tool runs, so the caller can see she's on it. */
  function workingLabel(tool: string) {
    const n = shown();
    const en: Record<string, string> = {
      place_order: `${n} is placing your order…`,
      add_to_bag: `${n} is adding it to your bag…`,
      check_table: `${n} is checking the tables…`,
      reserve_table: `${n} is booking your table…`,
      book_party: `${n} is booking your party…`,
      check_order: `${n} is checking your order…`,
      request_callback: `${n} is letting the team know…`,
      save_booking_email: `${n} is saving your email…`,
    };
    const ur: Record<string, string> = {
      place_order: 'آپ کا آرڈر لگایا جا رہا ہے…',
      add_to_bag: 'بیگ میں ڈالا جا رہا ہے…',
      check_table: 'ٹیبل چیک ہو رہی ہے…',
      reserve_table: 'ٹیبل بک ہو رہی ہے…',
      book_party: 'پارٹی بک ہو رہی ہے…',
      check_order: 'آپ کا آرڈر چیک ہو رہا ہے…',
      request_callback: 'ٹیم کو بتایا جا رہا ہے…',
      save_booking_email: 'ای میل محفوظ ہو رہی ہے…',
    };
    return (lang === 'ur' ? ur : en)[tool] || ui().thinking;
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
    logEl.append(li);
    setText(li, text);
    return li;
  }
  /** Scrolled up to reread something: new words don't yank the view back down. */
  const atBottom = () => logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
  // Something above the log grew (the summary, the order card): stay on the newest line if that's where they were.
  let pinned = true;
  on(logEl, 'scroll', () => (pinned = atBottom()));
  const logSize = new ResizeObserver(() => pinned && (logEl.scrollTop = logEl.scrollHeight));
  logSize.observe(logEl);
  function setText(li: HTMLElement, text: string) {
    li.textContent = text;
    li.classList.remove('hearing');
    li.dir = isUrdu(text) ? 'rtl' : 'auto';
    if (pinned) logEl.scrollTop = logEl.scrollHeight;
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
    label('#vc-pick-lang-step', t.stepLanguage);
    label('#vc-pick-lang-title', t.chooseLanguage);
    label('#vc-pick-lang-help', t.languageHelp);
    label('#vc-pick-why-step', t.stepPurpose);
    label('#vc-why-q', t.why);
    label('#vc-why-help', t.purposeHelp);
    label('#vc-order-title', t.order);
    label('#vc-order-detail', t.orderDetail);
    label('#vc-complaint-title', t.complaint);
    label('#vc-complaint-detail', t.complaintDetail);
    label('#vc-call-note', t.callNote);
    label('#vc-why-back span', t.back);
    for (const b of modal!.querySelectorAll('[data-lang].vcall-choice')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.lang === lang));
    renderSummary();
    label('#vc-voice-switch > span', t.talkTo(shown(other)));
    label('#voice-keypad-toggle span', t.type);
    label('#voice-hangup-btn span', t.end);
    label('#voice-unblock-btn', alertRetry ? t.retry : t.tryMic);
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

  /** `retry`: the button tries the line again rather than the mic. */
  let alertRetry = false;
  /** The caller picked a language: use it for this call and remember it for the next. */
  function chooseLang(next: Lang) {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
  }

  function showAlert(text: string | null, retry = false) {
    if (!alertEl) return;
    alertRetry = !!text && retry;
    alertEl.hidden = !text;
    if (text && alertText) alertText.textContent = text;
    const btn = $('voice-unblock-btn');
    if (btn) btn.textContent = retry ? ui().retry : ui().tryMic;
  }

  /** Before a call: the language step, or what the call is about. */
  function pickStep(step: 'lang' | 'why') {
    pickLang?.toggleAttribute('hidden', step !== 'lang');
    pickWhy?.toggleAttribute('hidden', step !== 'why');
    modal!.dataset.pickStep = step;
    const focus = step === 'lang'
      ? modal!.querySelector<HTMLButtonElement>('.vcall-choice[data-lang]')
      : modal!.querySelector<HTMLButtonElement>('.vcall-choice[data-why]');
    window.setTimeout(() => focus?.focus(), 0);
  }

  function renderSummary() {
    if (!sumEl || !sumRows) return;
    const rows = summaryRows(summary, lang);
    sumRows.replaceChildren(
      ...rows.flatMap(([k, v]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = k;
        dd.textContent = v;
        dd.dir = 'auto';
        return [dt, dd];
      }),
    );
    // During a call it's always there; afterwards only if something was noted.
    sumEl.hidden = !inCall && rows.length < 2;
    const h = $('vc-sum-h');
    if (h) h.textContent = ui().noted(shown());
  }
  const nameOf = (id: string) => productById(id)?.name || '';

  /* Sarah owes an answer (the caller spoke, a tool came back): if nothing
     comes for a while, say so and offer a retry instead of silence. */
  function expectAnswer() {
    clearTimeout(answerWatch);
    if (!inCall || engine !== 'live') return;
    const seq = callSeq;
    answerWatch = window.setTimeout(() => {
      if (seq !== callSeq || !inCall || reconnecting || live?.speaking) return;
      stopWorkingSound();
      showAlert(ui().noAnswer(shown()), true);
      setPhase(muted ? 'muted' : 'listening', ui().noConnect);
    }, NO_ANSWER_MS);
  }
  function answered() {
    if (!answerWatch) return;
    clearTimeout(answerWatch);
    answerWatch = 0;
    if (alertRetry) showAlert(null);
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
  /* While a tool runs: soft keys being typed on the till, quiet, irregular, until the answer is back. */
  let keysTimer = 0;
  function startWorkingSound() {
    stopWorkingSound();
    let c: AudioContext;
    try {
      c = ensureAudio();
    } catch {
      return;
    }
    const tap = () => {
      try {
        const len = Math.floor(c.sampleRate * 0.025);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = c.createBufferSource();
        const band = c.createBiquadFilter();
        const g = c.createGain();
        src.buffer = buf;
        band.type = 'bandpass';
        band.frequency.value = 1800 + Math.random() * 1600;
        g.gain.value = 0.05 + Math.random() * 0.03;
        src.connect(band).connect(g).connect(c.destination);
        src.start();
      } catch {}
      // a burst of keys, then a short pause, like someone typing an order in
      keysTimer = window.setTimeout(tap, Math.random() < 0.18 ? 380 + Math.random() * 300 : 70 + Math.random() * 110);
    };
    keysTimer = window.setTimeout(tap, 120);
  }
  function stopWorkingSound() {
    clearTimeout(keysTimer);
    keysTimer = 0;
  }
  /* Done: three bright notes going up. */
  function tada() {
    try {
      const c = ensureAudio();
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        const t = c.currentTime + i * 0.11;
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 2 ? 0.55 : 0.22));
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.6);
      });
    } catch {}
  }

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
        answered();
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
    summary = emptySummary(purpose);
    // What they picked on the screen goes in as their opening words, so Sarah starts on it (both lines read the history).
    const opener = ui().purpose[purpose];
    if ([...history].reverse().find((t) => t.role === 'user')?.content !== opener) history.push({ role: 'user', content: opener });
    setMode('call');
    renderSummary();
    updateChips();
    ensureAudio();
    triggerHaptic?.(30);
    setPhase('ringing');
    stopRing = ringback();
    const ringStarted = performance.now();
    const ringMs = ringFor();

    const lineP = openLine();

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
      renderSummary();
      return;
    }

    // Wake the tool line now, so the first booking or order mid-call isn't waiting on a cold start.
    fetch('/api/voice/live/tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"warm":true}' }).catch(() => {});
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
      expectAnswer();
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
    stopWorkingSound();
    inCall = false;
    clearTimeout(answerWatch);
    answerWatch = 0;
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
    renderSummary();
    pickStep('lang');
    // Ordered on this call: once it's over (Sarah's goodbye or the caller hanging up), show the order's live tracking.
    const placed = placedThisCall;
    placedThisCall = null;
    if (placed && how !== 'switch' && openTracking)
      setTimeout(() => {
        closeModal();
        openTracking(placed);
      }, 1400);
  }

  /* ── the live line ── */

  function onLive(e: LiveEvent) {
    if (e.type === 'user-text') {
      userBuf += e.text;
      if (!userLi) userLi = bubble('you', '', true);
      const heard = toUrduScript(userBuf.trim());
      setText(userLi, heard);
      if (!heard) return;
      liveTurnDone = false;
      expectAnswer();
    } else if (e.type === 'agent-text') {
      agentBuf += e.text;
      if (!agentLi) agentLi = bubble('agent');
      const said = toUrduScript(agentBuf.trim());
      setText(agentLi, said);
      liveTurnDone = false;
      answered();
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
      answered();
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
    return fetch('/api/voice/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId, gender, lang, purpose, recap, resume }), signal: AbortSignal.timeout(10000) })
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
          expectAnswer();
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
    const busy = calls.find((c) => c.name !== 'end_call');
    if (busy) {
      setPhase('thinking', workingLabel(busy.name));
      note(workingLabel(busy.name));
      startWorkingSound();
    }
    for (const c of calls) summary = noteTool(summary, c.name, c.args || {}, nameOf);
    renderSummary();
    // The words the caller just said can trail the tool call by a beat; only the ones that need their "yes" wait for it.
    if (calls.some((c) => NEEDS_YES.has(c.name))) for (let i = 0; i < 5 && !userBuf.trim(); i++) await sleep(70);
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
          if (seq === callSeq) for (const a of (d.actions || []) as Action[]) handleAction(a, true);
          return { id: c.id, name: c.name, response: d.output ?? { error: d.error || 'The system did not answer.' } };
        } catch {
          return { id: c.id, name: c.name, response: { error: 'The booking system did not respond. Apologise and offer to try again.' } };
        }
      }),
    );
    stopWorkingSound();
    if (seq !== callSeq) return;
    // Something got done (booked, ordered, added): a little ta-da, like a till that's gone through.
    if (responses.some((r) => !('error' in (r.response as object)) && DONE_SOUND.has(r.name))) tada();
    live?.sendToolResponses(responses);
    expectAnswer();
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
      body: JSON.stringify({ message, gender, history, state: scriptState, lang, purpose, callId, channel }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The line is busy (${res.status})`);
    scriptState = data.state || {};
    if (!inCall && (data.lang === 'ur' || data.lang === 'en') && data.lang !== lang) setLang(data.lang);
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
      if (voice) await playBlob(voice.blob, id, parts[i].text);
      else await speakWithDevice(parts[i].text, id);
      if (id !== turnId) return;
    }
    if (shown !== reply && !audio?.length) setText(li, reply);
    if (hangUpAfterSpeech) return void setTimeout(() => inCall && endCall(), 300);
    stepsListen();
  }

  /** One clip of the step-by-step voice. It plays through the page's AudioContext,
      which the tap that opened the call unlocked, as the live line does. An <audio>
      element started seconds after that tap (after the ring and the fetch) is refused
      by strict autoplay rules (Brave, Safari), and a refused play() used to pass for
      "finished": the reply was silent. Now the element is only a second try, and if it
      is refused too the device reads the line out, so a reply is never silent. */
  async function playBlob(blob: Blob, id: number, text: string) {
    const c = ctx;
    if (c && c.state !== 'closed' && outGain) {
      if (c.state !== 'running') await c.resume().catch(() => {});
      if (c.state === 'running') {
        try {
          const buf = await c.decodeAudioData(await blob.arrayBuffer());
          if (id !== turnId) return;
          return await playBuffer(c, buf, id);
        } catch (err) {
          console.warn('[brewns-call] could not decode the voice, trying the audio element:', err);
        }
      }
    }
    if (id !== turnId || (await playElement(blob, id))) return;
    console.warn('[brewns-call] the browser refused to play the voice; the device reads the line instead');
    setVoiceTag('device');
    await speakWithDevice(text, id);
  }

  function playBuffer(c: AudioContext, buf: AudioBuffer, id: number) {
    return new Promise<void>((resolve) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(outGain!);
      clip = src;
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        clearInterval(watch);
        clearTimeout(cap);
        if (clip === src) clip = null;
        resolve();
      };
      src.onended = finish;
      src.start();
      const watch = setInterval(() => {
        if (id !== turnId) {
          try {
            src.stop();
          } catch {}
          finish();
        }
      }, 100);
      // A context the phone suspends mid-clip never says 'ended': the call carries on anyway.
      const cap = setTimeout(finish, buf.duration * 1000 + 1500);
    });
  }

  /** The <audio> element as a second try; resolves false if the browser refused to play it. */
  function playElement(blob: Blob, id: number) {
    return new Promise<boolean>((resolve) => {
      if (!player) {
        player = new Audio();
        player.setAttribute('playsinline', '');
      }
      const p = player;
      const url = URL.createObjectURL(blob);
      let started = false;
      const done = (played: boolean) => {
        clearInterval(watch);
        URL.revokeObjectURL(url);
        p.onended = p.onerror = p.onplaying = null;
        resolve(played);
      };
      p.onplaying = () => (started = true);
      p.onended = () => done(true);
      p.onerror = () => done(started);
      p.src = url;
      p.play().catch(() => done(false));
      const watch = setInterval(() => {
        if (id !== turnId) {
          p.pause();
          done(true);
        }
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
    if (clip) {
      try {
        clip.stop();
      } catch {}
      clip = null;
    }
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
        expectAnswer();
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

  function handleAction(action: Action, fromLive = false) {
    summary = noteAction(summary, action, nameOf, fromLive);
    renderSummary();
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
    } else if (action.type === 'ORDER_PLACED') {
      const { order, key } = action.data || {};
      if (!order?.number || !key) return;
      onOrderPlaced?.(order, key);
      placedThisCall = order.number;
      playChime?.();
      triggerHaptic?.(60);
      toast(`ORDER #${String(order.number).padStart(5, '0')} PLACED`);
      const card = modal!.querySelector<HTMLElement>('.vcall-card');
      if (card)
        showVoiceOrder(card, order, key, (n) => {
          closeModal();
          openTracking?.(n);
        });
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
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    pickStep('lang');
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
    returnFocus?.focus();
    returnFocus = null;
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
    const line = await openLine();
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
        expectAnswer();
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
  // Before a call: tap a language (kept for next time), then what it's about, which dials.
  for (const b of modal.querySelectorAll<HTMLElement>('.vcall-choice[data-lang]'))
    on(b, 'click', (e: Event) => {
      e.preventDefault();
      playSoftClick?.();
      chooseLang(b.dataset.lang === 'ur' ? 'ur' : 'en');
      pickStep('why');
    });
  for (const b of modal.querySelectorAll<HTMLElement>('.vcall-choice[data-why]'))
    on(b, 'click', (e: Event) => {
      e.preventDefault();
      purpose = b.dataset.why === 'complaint' ? 'complaint' : 'order';
      void startCall();
    });
  on($('vc-why-back'), 'click', (e: Event) => {
    e.preventDefault();
    pickStep('lang');
  });
  on(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !modal!.hidden) closeModal();
    if (e.key !== 'Tab' || modal!.hidden) return;
    const focusable = [...modal!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.closest('[hidden]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  on(window, 'pagehide', () => inCall && endCall());
  on(document, 'visibilitychange', () => !document.hidden && wakeAudio());
  // Back online after a dead spot: don't wait for the old socket to time out.
  on(window, 'online', () => {
    if (!inCall || engine !== 'live' || !live) return;
    if (!live.open) void reconnectLive('dropped');
    else if (!reconnecting) setPhase(muted ? 'muted' : live.speaking ? 'speaking' : 'listening');
  });
  // Lost signal mid-call: say so now; the line reconnects when it's back.
  on(window, 'offline', () => inCall && setPhase('connecting', ui().offline));

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
    chooseLang(lang === 'en' ? 'ur' : 'en');
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
    // Mid-call, Sarah went quiet: a fresh line (the step-by-step one if live won't come back). Otherwise dial again.
    if (!inCall) void startCall();
    else if (engine === 'live' && live) void reconnectLive('dropped');
    else stepsListen();
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
    logSize.disconnect();
    ac.abort();
  };
}
