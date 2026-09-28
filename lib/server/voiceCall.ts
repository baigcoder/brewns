/* The voice concierge: what Sarah / Hamza hear, think and say.

   Two brains behind one call:
   - Gemini, when GEMINI_API_KEY is set. A real conversation: it listens,
     asks one thing at a time, reads the booking back before it commits, and
     books through tools that write to the same store as the website forms.
   - A small slot-filling script otherwise, so the call still works on a laptop
     with no keys. It asks for the same details, one at a time, and keeps its
     place in `state`, which the browser sends back with the next turn.

   The voice is ElevenLabs when ELEVENLABS_API_KEY is set, streamed to the
   browser so it starts talking straight away; without it the browser speaks
   the reply with its own voice. */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { kv, withLock } from './store';
import { CATALOG, CLOSE_MIN, DELIVERY, LOC_TITLES, OPEN_MIN, SHOP_COUNT, catalogItem, defaultSel, money, pkMobile, unitPrice, validSel, type Product, type Sel } from '@/lib/catalog';
import type { Reservation } from '@/app/api/reservations/route';
import { sendBookingConfirmationEmail } from './email';
import { sendBookingWhatsappNotification, buildBookingWhatsappMessage, getWhatsappDirectLink } from './smsWhatsapp';
import { bumpLive } from './orders';

export type VoiceGender = 'female' | 'male';

export interface VoiceTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BagLine {
  id: string;
  qty: number;
  sel: Sel;
  name: string;
}

export type VoiceAction =
  | { type: 'ADD_TO_BAG'; data: { items: BagLine[]; total: number } }
  | { type: 'RESERVE_TABLE'; data: Reservation }
  | { type: 'BOOK_PARTY'; data: PartyBooking }
  | { type: 'SAVED_EMAIL'; data: { email: string; code?: string; sent: boolean } }
  | { type: 'WHATSAPP_VOUCHER'; data: { phone: string; code: string; whatsappUrl: string; sent: boolean } }
  | { type: 'END_CALL' };

export interface PartyBooking {
  id: string;
  code: string;
  type: string;
  name: string;
  phone: string;
  email?: string;
  emailSent?: boolean;
  emailSentAt?: number;
  whatsappSent?: boolean;
  whatsappSentAt?: number;
  whatsappUrl?: string;
  location: string;
  loc: number;
  date: string;
  time: string;
  guests: number;
  status: 'confirmed' | 'done' | 'cancelled';
  notes: string;
  source: 'voice';
  createdAt: number;
}

/** Where the fallback script is in a booking; the browser echoes it back. */
export interface ScriptState {
  flow?: 'table' | 'party';
  slots?: Partial<Record<'name' | 'phone' | 'email' | 'loc' | 'date' | 'time' | 'guests' | 'area' | 'occasion', string>>;
  confirming?: boolean;
  waitingForEmail?: boolean;
  confirmedCode?: string;
  confirmedKind?: 'table' | 'party';
}

export interface VoiceCallResponse {
  reply: string;
  /** Where the browser streams the ElevenLabs voice from; absent without a key. */
  audioUrl?: string;
  actions: VoiceAction[];
  state?: ScriptState;
  brain: 'groq' | 'gemini' | 'script';
  /** The language the caller spoke, so the browser listens in it next turn. */
  lang: VoiceLang;
}

export const agentName = (g: VoiceGender) => (g === 'male' ? 'Hamza' : 'Sarah');

/* ═══════════ voice ═══════════ */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE_IDS: Record<VoiceGender, string> = {
  female: process.env.ELEVENLABS_VOICE_ID_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Sarah
  male: process.env.ELEVENLABS_VOICE_ID_MALE || 'JBFqnCBsd6RMkjVDRZzb', // George
};

export type VoiceLang = 'en' | 'ur';

/* Words that only turn up when someone is speaking Urdu in Latin letters
   ("mujhe kal table chahiye"). Two of them, or one in a short line, is enough. */
const ROMAN_URDU = /\b(hai|hain|hay|mujhe|mujhay|humein|hamein|aap|ap|apka|apki|kya|kia|kyun|kaise|kaisa|kitne|kitna|chahiye|chahie|karna|karni|karen|kardo|kar do|dein|dain|nahi|nahin|haan|han|ji|jee|theek|thik|acha|accha|achha|shukriya|meherbani|log|logon|baje|shaam|sham|subah|raat|kal|parso|aaj|mein|main|ke liye|wala|wali|bhai|yaar|batao|bataen|bataiye|kab|kahan|kidhar|bohat|bahut|zaroor|salam|assalam|walaikum)\b/gi;

/** Which language the caller is speaking: Urdu script or Roman Urdu → 'ur'. */
export function detectLang(text: string): VoiceLang {
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const hits = (text.match(ROMAN_URDU) || []).length;
  return hits >= 2 || (hits === 1 && words <= 3 && !/^(ji|han|haan|salam)$/i.test(text.trim())) ? 'ur' : 'en';
}

/* Once a caller is speaking Urdu, a line of names and numbers ("terrace, Hamad
   Baig, 0300 1234567") shouldn't flip the call to English; a real English
   sentence should. */
const ENGLISH = /\b(the|is|are|what|when|where|how|can|could|would|will|you|your|i|i'm|i'd|we|my|please|want|like|tell|have|do|does|about|price|in english)\b/gi;
export const clearlyEnglish = (text: string) => (text.match(ENGLISH) || []).length >= 2 && !(text.match(ROMAN_URDU) || []).length;

/** Urdu written in Urdu script is what the Urdu voice reads properly. */
export const replyLang = (reply: string): VoiceLang => (/[\u0600-\u06FF]/.test(reply) ? 'ur' : 'en');

/** What the voice should say, as a person would say it: "Rs 2,550" → "2,550
    rupees", a mobile number in the groups people read it in. The caption keeps
    the written form. */
export function forSpeech(text: string, lang: VoiceLang = 'en') {
  return text
    .replace(/\bRs\.?\s?([\d,]+)/g, lang === 'ur' ? '$1 روپے' : '$1 rupees')
    .replace(/\b(03\d{2})[\s-]?(\d{3})[\s-]?(\d{4})\b/g, (_, a: string, b: string, c: string) => [a, b, c].map((g) => g.split('').join(' ')).join(', '))
    .replace(/\s*—\s*/g, ', ')
    .replace(/(\d)\s*×\s*/g, '$1 ');
}

export const ttsEnabled = () => Boolean(ELEVENLABS_API_KEY);

/* The browser fetches the voice from /api/voice/tts, so it can start playing
   the first words while ElevenLabs is still speaking the rest. The URL carries
   the reply signed by this server, so the endpoint only ever speaks our own
   lines and can't be used to spend the café's characters on anything else. */

const ttsSecret = () => createHmac('sha256', 'brewns-voice-tts').update(process.env.SESSION_SECRET || ELEVENLABS_API_KEY).digest();
const TTS_TTL_MS = 10 * 60_000;

export function ttsUrl(text: string, gender: VoiceGender, lang: VoiceLang = 'en') {
  const payload = Buffer.from(JSON.stringify({ t: forSpeech(text, lang).slice(0, 900), g: gender, l: lang, e: Date.now() + TTS_TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', ttsSecret()).update(payload).digest('base64url');
  return `/api/voice/tts?p=${payload}&s=${sig}`;
}

export function readTtsToken(payload: string, sig: string): { text: string; gender: VoiceGender; lang: VoiceLang } | null {
  if (!payload || !sig || !ELEVENLABS_API_KEY) return null;
  const want = createHmac('sha256', ttsSecret()).update(payload).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const { t, g, l, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof t !== 'string' || !t || Number(e) < Date.now()) return null;
    return { text: t, gender: g === 'male' ? 'male' : 'female', lang: l === 'ur' ? 'ur' : 'en' };
  } catch {
    return null;
  }
}

/** Stream `text` from ElevenLabs as MP3. Conversational settings: a little less
    stable and a little more style than narration, so it sounds like someone
    talking, not reading. Null when it fails; the browser then uses its own voice. */
/* English uses Flash v2.5, the fastest model. Urdu isn't one of Flash's
   languages, so Urdu lines go to Eleven v3, which speaks it natively (override
   with ELEVENLABS_URDU_MODEL_ID). v3 takes only a few stability steps. */
const TTS_MODEL: Record<VoiceLang, string> = {
  en: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  ur: process.env.ELEVENLABS_URDU_MODEL_ID || 'eleven_v3',
};
const voiceSettings = (model: string) =>
  model.startsWith('eleven_v3') ? { stability: 0.5, similarity_boost: 0.8 } : { stability: 0.38, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.02 };

export async function streamElevenLabsVoice(text: string, gender: VoiceGender, lang: VoiceLang = 'en'): Promise<ReadableStream<Uint8Array> | null> {
  if (!ELEVENLABS_API_KEY || !text) return null;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[gender]}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL[lang],
        voice_settings: voiceSettings(TTS_MODEL[lang]),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok || !res.body) {
      console.error('[ElevenLabs TTS]', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return null;
    }
    return res.body;
  } catch (err) {
    console.error('[ElevenLabs TTS]', err instanceof Error ? err.message : err);
    return null;
  }
}

/* ═══════════ dates and times, in Lahore ═══════════ */

const TZ = 'Asia/Karachi';

function lahoreNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: parts.weekday as string, clock: `${parts.hour}:${parts.minute}` };
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "tomorrow", "friday", "12 october", "2026-10-02" → YYYY-MM-DD, or '' */
export function parseDate(text: string): string {
  const t = text.toLowerCase();
  const today = lahoreNow().date;
  const iso = t.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (iso) return iso[0];
  if (/\b(today|tonight|aaj)\b/.test(t)) return today;
  if (/\b(day after tomorrow|parso)\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|kal)\b/.test(t)) return addDays(today, 1);
  const wd = WEEKDAYS.findIndex((w) => t.includes(w));
  if (wd >= 0) {
    const cur = new Date(`${today}T12:00:00Z`).getUTCDay();
    return addDays(today, ((wd - cur + 7) % 7) || 7);
  }
  const dm = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3})[a-z]*\b/) || t.match(/\b([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dm) {
    const [day, mon] = /^\d/.test(dm[1]) ? [Number(dm[1]), dm[2]] : [Number(dm[2]), dm[1]];
    const m = MONTHS.indexOf(mon);
    if (m >= 0 && day >= 1 && day <= 31) {
      let year = Number(today.slice(0, 4));
      const cand = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (cand < today) year++;
      return `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

/** "8pm", "8:30 pm", "20:00", "evening" → minutes after midnight, or -1 */
export function parseTime(text: string): number {
  const t = text
    .toLowerCase()
    .replace(/\b(?:for|of)\s+\d{1,3}(?!\s*(?::\d|am|pm|a\.m|p\.m|o'?clock))\b/g, ' ')
    .replace(/\b\d{1,3}\s*(?:people|guests|persons|pax|log|of us|friends|adults)\b/g, ' ');
  const all = [...t.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/g)];
  const m = all.find((x) => x[3] || x[2]) || all.find((x) => new RegExp(`\\b(at|around|by|about)\\s+${x[1]}\\b`).test(t)) || (all.length === 1 && /^\s*\d{1,2}\s*(o'?clock)?\s*$/.test(t) ? all[0] : null);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ap = m[3]?.[0];
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    // "at 8" in a café that closes at nine means the evening.
    if (!ap && h >= 1 && h <= 8) h += 12;
    if (h <= 23 && min <= 59) return h * 60 + min;
  }
  const baje = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*baje\b/);
  if (baje) {
    let h = Number(baje[1]);
    if (/\b(shaam|sham|raat|dopahar|dopehar)\b/.test(t) || (!/\b(subah|subha)\b/.test(t) && h >= 1 && h <= 8)) h = h < 12 ? h + 12 : h;
    return h * 60 + Number(baje[2] || 0);
  }
  if (/\b(morning|subah|subha)\b/.test(t)) return 10 * 60;
  if (/\b(lunch|afternoon)\b/.test(t)) return 14 * 60;
  if (/\b(evening|dinner|tonight)\b/.test(t)) return 19 * 60;
  return -1;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const validISODate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
};
const spokenTime = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const spokenDate = (iso: string) => {
  const today = lahoreNow().date;
  if (iso === today) return 'today';
  if (iso === addDays(today, 1)) return 'tomorrow';
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
};
/** "RES-4821" read out as "R E S, 4 8 2 1" so it survives a phone line. */
const spokenCode = (code: string) => code.split('-').map((part) => part.split('').join(' ')).join(', ');
/** "CRISPY ZINGER BURGER" → "Crispy Zinger Burger", so the voice doesn't shout it. */
const titleCase = (t: string) => t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sp, ch) => sp + ch.toUpperCase());
/** "DHA PHASE 1–6" → "DHA Phase 1 to 6" */
const spokenArea = (a: string) => titleCase(a).replace(/\bDha\b/g, 'DHA').replace(/\s*–\s*/g, ' to ');
const withArticle = (t: string) => `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}`;

export function parseShop(text: string): number {
  const t = text.toLowerCase();
  if (/\b(dha|defence|defense|cca|phase 5)\b/.test(t)) return 1;
  if (/\b(johar|wapda|main boulevard)\b/.test(t)) return 2;
  if (/\b(gulberg|mm alam|m\.m\.|alam road|mma)\b/.test(t)) return 0;
  return -1;
}

/* ═══════════ bookings: the checks and the writes ═══════════ */

/** Parse and normalize email addresses from spoken voice transcripts or typed text.
 *  Handles "alex at gmail dot com", "hassan.baig at gmail.com", "name @ domain . com", etc. */
export function parseEmail(text: string): string {
  if (!text) return '';
  const raw = text.trim();
  // 1. Direct standard email match
  const directMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (directMatch) return directMatch[0].toLowerCase();

  // 2. Normalize spoken speech recognition artifacts
  let norm = raw
    .toLowerCase()
    .replace(/[\u0600-\u06FF]/g, ' ') // strip Urdu script if mixed
    .replace(/\s+(at|@)\s+/gi, '@')
    .replace(/\s+(dot|\.)\s+/gi, '.')
    .replace(/\s+(underscore|_)\s+/gi, '_')
    .replace(/\s+(dash|-)\s+/gi, '-');

  // Collapse spaces only between single spaced letters: "a l e x @ g m a i l . c o m" -> "alex@gmail.com"
  for (let i = 0; i < 6; i++) {
    norm = norm.replace(/(?<=\b[a-z0-9])\s+(?=[a-z0-9]\b)/gi, '');
  }

  const m = norm.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (m) return m[0].toLowerCase();

  // Also catch spoken "alex@gmail" without the .com
  const noTld = norm.match(/([a-zA-Z0-9._%+-]+)@(gmail|yahoo|hotmail|outlook|icloud)\b/);
  if (noTld) return `${noTld[1]}@${noTld[2]}.com`.toLowerCase();

  return '';
}

function extractBookingCode(text: string): string | undefined {
  const direct = text.match(/\b(RES|PTY)-([A-Z0-9]{4,6})\b/i);
  if (direct) return `${direct[1].toUpperCase()}-${direct[2].toUpperCase()}`;
  const spoken = text.match(/\b(R\s*E\s*S|P\s*T\s*Y)[,:;\s-]+((?:\d[\s,]*){4,6})/i);
  const digits = spoken?.[2].replace(/\D/g, '');
  return digits && digits.length >= 4 && digits.length <= 6 ? `${/R\s*E\s*S/i.test(spoken![1]) ? 'RES' : 'PTY'}-${digits}` : undefined;
}

const bookingCodeFromHistory = (history: VoiceTurn[]) => extractBookingCode(history.map((turn) => turn.content).join(' '));

export async function attachEmailToBooking(
  email: string,
  codeOrPhone?: string,
  kind?: 'table' | 'party',
): Promise<{ ok: boolean; code?: string; details?: any; sent?: boolean }> {
  const clean = parseEmail(email);
  if (!clean) return { ok: false };

  let foundBooking: {
    code: string;
    name: string;
    phone: string;
    loc: number;
    date: string;
    time: string;
    guests: number;
    area?: string;
    occasion?: string;
    kind: 'table' | 'party';
    emailSent?: boolean;
  } | null = null;
  let emailNeedsSending = false;
  let emailWasAlreadySent = false;

  const phoneMatch = codeOrPhone ? pkMobile(codeOrPhone) : '';
  const searchCode = (codeOrPhone || '').toUpperCase().trim();

  // 1. Search in reservations
  if (kind !== 'party') {
    foundBooking = await withLock('reservations', async () => {
      const all = (await kv.hall<Reservation>('reservations')) || {};
      const list = Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
      const target = list.find((r) => {
        if (searchCode && (r.code === searchCode || r.code.replace(/-/g, '') === searchCode.replace(/-/g, ''))) return true;
        if (phoneMatch && r.phone === phoneMatch) return true;
        return false;
      }) || null;

      if (target) {
        emailNeedsSending = target.email !== clean || target.emailSent !== true;
        emailWasAlreadySent = target.email === clean && target.emailSent === true;
        if (emailNeedsSending) {
          target.email = clean;
          await kv.hset('reservations', target.id, target);
        }
        return {
          code: target.code,
          name: target.name,
          phone: target.phone,
          loc: target.loc,
          date: target.date,
          time: target.time,
          guests: target.guests,
          area: target.area,
          emailSent: target.emailSent,
          kind: 'table' as const,
        };
      }
      return null;
    });
  }

  // 2. Search in party bookings
  if (!foundBooking && kind !== 'table') {
    foundBooking = await withLock('party_bookings', async () => {
      const all = (await kv.hall<PartyBooking>('party_bookings')) || {};
      const list = Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
      const target = list.find((p) => {
        if (searchCode && (p.code === searchCode || p.code.replace(/-/g, '') === searchCode.replace(/-/g, ''))) return true;
        if (phoneMatch && p.phone === phoneMatch) return true;
        return false;
      }) || null;

      if (target) {
        emailNeedsSending = target.email !== clean || target.emailSent !== true;
        emailWasAlreadySent = target.email === clean && target.emailSent === true;
        if (emailNeedsSending) {
          target.email = clean;
          await kv.hset('party_bookings', target.id, target);
        }
        return {
          code: target.code,
          name: target.name,
          phone: target.phone,
          loc: target.loc ?? 0,
          date: target.date,
          time: target.time,
          guests: target.guests,
          occasion: target.type,
          emailSent: target.emailSent,
          kind: 'party' as const,
        };
      }
      return null;
    });
  }

  if (foundBooking) {
    let sent = emailWasAlreadySent;
    if (emailNeedsSending) {
      await bumpLive();
      const result = await sendBookingConfirmationEmail({
        code: foundBooking.code,
        name: foundBooking.name,
        email: clean,
        phone: foundBooking.phone,
        loc: foundBooking.loc,
        date: foundBooking.date,
        time: foundBooking.time,
        guests: foundBooking.guests,
        area: foundBooking.area,
        occasion: foundBooking.occasion,
        kind: foundBooking.kind,
      }).catch((err) => {
        console.error('[Voice Email Send Error]', err);
        return { ok: false as const, sentVia: 'local_record' as const };
      });
      sent = result.sentVia !== 'local_record';
    }

    return { ok: true, code: foundBooking.code, details: foundBooking, sent };
  }

  return { ok: false };
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

interface BookingInput {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  shop?: unknown;
  date?: unknown;
  time?: unknown;
  guests?: unknown;
  area?: unknown;
  occasion?: unknown;
  notes?: unknown;
}

const s = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : typeof v === 'number' ? String(v) : '');

function checkBooking(b: BookingInput, kind: 'table' | 'party'): Check<{ name: string; phone: string; loc: number; date: string; time: string; guests: number }> {
  const name = s(b.name, 60);
  const phone = pkMobile(s(b.phone, 20));
  const loc = typeof b.shop === 'number' ? b.shop : parseShop(s(b.shop));
  const dateText = s(b.date);
  const date = validISODate(dateText) ? dateText : parseDate(dateText);
  const tMin = /^\d{2}:\d{2}$/.test(s(b.time)) ? Number(s(b.time).slice(0, 2)) * 60 + Number(s(b.time).slice(3)) : parseTime(s(b.time));
  const guests = Math.round(Number(b.guests));
  const now = lahoreNow();
  const [minGuests, maxGuests] = kind === 'table' ? [1, 20] : [8, 120];

  if (name.length < 2) return { ok: false, error: 'Need the guest name.' };
  if (!phone) return { ok: false, error: 'Need a valid Pakistani mobile number (03XX XXXXXXX).' };
  if (!Number.isInteger(loc) || loc < 0 || loc >= SHOP_COUNT) return { ok: false, error: 'Need which counter: 0 MM Alam Road, 1 DHA Phase 5, 2 Johar Town.' };
  if (!validISODate(date)) return { ok: false, error: 'Need a real date such as tomorrow or 2026-10-02.' };
  if (date < now.date) return { ok: false, error: 'That date is in the past.' };
  if (date > addDays(now.date, 90)) return { ok: false, error: 'Bookings open 90 days ahead at most.' };
  if (tMin < 0) return { ok: false, error: 'Need a time (HH:MM, 24-hour).' };
  if (tMin < OPEN_MIN || tMin > CLOSE_MIN - 60) return { ok: false, error: `We seat between ${spokenTime(hhmm(OPEN_MIN))} and ${spokenTime(hhmm(CLOSE_MIN - 60))}; we close at ${spokenTime(hhmm(CLOSE_MIN))}.` };
  if (date === now.date && tMin < now.minutes + 30) return { ok: false, error: 'That time today is too soon; need at least 30 minutes from now.' };
  if (!Number.isInteger(guests) || guests < minGuests || guests > maxGuests)
    return { ok: false, error: kind === 'table' ? 'Tables take 1 to 20 guests; bigger groups are a party booking.' : 'Party bookings are for 8 to 120 guests; smaller groups can just book a table.' };
  return { ok: true, value: { name, phone, loc, date, time: hhmm(tMin), guests } };
}

const makeCode = (prefix: string) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

async function saveReservation(b: BookingInput, transcript: string): Promise<Check<Reservation>> {
  const c = checkBooking(b, 'table');
  if (!c.ok) return c;
  const areaRaw = s(b.area).toLowerCase();
  const area: Reservation['area'] = areaRaw === 'terrace' || areaRaw === 'bar' ? areaRaw : 'indoor';
  const email = parseEmail(s(b.email));
  const item = await withLock('reservations', async () => {
    // The same guest, shop and slot again (a repeated "yes", a retried turn): that's the booking already made.
    const same = Object.values((await kv.hall<Reservation>('reservations')) || {}).find(
      (x) => x.status !== 'cancelled' && x.phone === c.value.phone && x.loc === c.value.loc && x.date === c.value.date && x.time === c.value.time,
    );
    if (same) {
      if (email && !same.email) {
        same.email = email;
        await kv.hset('reservations', same.id, same);
        await bumpLive();
      }
      return same;
    }
    const r: Reservation = {
      id: `res_${Date.now()}_${randomBytes(3).toString('hex')}`,
      code: makeCode('RES'),
      ...c.value,
      email,
      area,
      notes: [s(b.notes, 200), 'Booked on the AI voice call.'].filter(Boolean).join(' · ').slice(0, 250) || transcript.slice(0, 250),
      status: 'confirmed',
      createdAt: Date.now(),
    };
    await kv.hset('reservations', r.id, r);
    await bumpLive();
    return r;
  });
  let emailSent = Boolean(item.emailSent);
  if (email && item.email === email && !emailSent) {
    const emailResult = await sendBookingConfirmationEmail({
      code: item.code,
      name: item.name,
      email,
      phone: item.phone,
      loc: item.loc,
      date: item.date,
      time: item.time,
      guests: item.guests,
      area: item.area,
      kind: 'table',
    }).catch((err) => {
      console.error('[Email Send Error]', err);
      return { ok: false as const, sentVia: 'local_record' as const };
    });
    emailSent = emailResult.sentVia !== 'local_record';
  }
  const whatsapp = item.whatsappSent && item.whatsappUrl
    ? { sentVia: 'twilio' as const, whatsappUrl: item.whatsappUrl }
    : await sendBookingWhatsappNotification({
    code: item.code,
    name: item.name,
    phone: item.phone,
    email: item.email,
    loc: item.loc,
    date: item.date,
    time: item.time,
    guests: item.guests,
    area: item.area,
    kind: 'table',
    }).catch((err) => {
      console.error('[WhatsApp Voucher Send Error]', err);
      return { sentVia: 'local_record' as const, whatsappUrl: getWhatsappDirectLink(item.phone, buildBookingWhatsappMessage({ ...item, kind: 'table' })) };
    });

  return { ok: true, value: { ...item, emailSent, whatsappSent: whatsapp.sentVia !== 'local_record', whatsappUrl: whatsapp.whatsappUrl } };
}

async function saveParty(b: BookingInput): Promise<Check<PartyBooking>> {
  const c = checkBooking(b, 'party');
  if (!c.ok) return c;
  const occasion = s(b.occasion, 40) || 'Private party';
  const email = parseEmail(s(b.email));
  const item = await withLock('party_bookings', async () => {
    const same = Object.values((await kv.hall<PartyBooking>('party_bookings')) || {}).find(
      (x) => x.status !== 'cancelled' && x.phone === c.value.phone && x.loc === c.value.loc && x.date === c.value.date && x.time === c.value.time,
    );
    if (same) {
      if (email && !same.email) {
        same.email = email;
        await kv.hset('party_bookings', same.id, same);
        await bumpLive();
      }
      return same;
    }
    const p: PartyBooking = {
      id: randomBytes(6).toString('hex'),
      code: makeCode('PTY'),
      type: occasion.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      ...c.value,
      email,
      location: LOC_TITLES[c.value.loc],
      status: 'confirmed',
      notes: [s(b.notes, 200), 'Booked on the AI voice call; the events team calls back to plan the menu.'].filter(Boolean).join(' · '),
      source: 'voice',
      createdAt: Date.now(),
    };
    await kv.hset('party_bookings', p.id, p);
    await bumpLive();
    return p;
  });
  let emailSent = Boolean(item.emailSent);
  if (email && item.email === email && !emailSent) {
    const emailResult = await sendBookingConfirmationEmail({
      code: item.code,
      name: item.name,
      email,
      phone: item.phone,
      loc: item.loc,
      date: item.date,
      time: item.time,
      guests: item.guests,
      occasion: item.type,
      kind: 'party',
    }).catch((err) => {
      console.error('[Email Send Error]', err);
      return { ok: false as const, sentVia: 'local_record' as const };
    });
    emailSent = emailResult.sentVia !== 'local_record';
  }
  const whatsapp = item.whatsappSent && item.whatsappUrl
    ? { sentVia: 'twilio' as const, whatsappUrl: item.whatsappUrl }
    : await sendBookingWhatsappNotification({
    code: item.code,
    name: item.name,
    phone: item.phone,
    email: item.email,
    loc: item.loc,
    date: item.date,
    time: item.time,
    guests: item.guests,
    occasion: item.type,
    kind: 'party',
    }).catch((err) => {
      console.error('[WhatsApp Voucher Send Error]', err);
      return { sentVia: 'local_record' as const, whatsappUrl: getWhatsappDirectLink(item.phone, buildBookingWhatsappMessage({ ...item, kind: 'party' })) };
    });

  return { ok: true, value: { ...item, emailSent, whatsappSent: whatsapp.sentVia !== 'local_record', whatsappUrl: whatsapp.whatsappUrl } };
}

function checkBag(items: unknown): Check<{ items: BagLine[]; total: number }> {
  if (!Array.isArray(items) || !items.length) return { ok: false, error: 'No items given.' };
  const lines: BagLine[] = [];
  let total = 0;
  for (const raw of items.slice(0, 12)) {
    const it = (raw || {}) as { id?: unknown; qty?: unknown; options?: unknown };
    const p = catalogItem(s(it.id, 40));
    if (!p) return { ok: false, error: `Unknown menu id "${s(it.id, 40)}". Use an id from the menu.` };
    if (p.gift) return { ok: false, error: 'Gift cards are bought on the website, not on a call.' };
    const qty = Math.min(20, Math.max(1, Math.round(Number(it.qty) || 1)));
    const sel = pickOptions(p, it.options);
    lines.push({ id: p.id, qty, sel, name: p.name });
    total += unitPrice(p, sel) * qty;
  }
  return { ok: true, value: { items: lines, total } };
}

/** { milk: "oat" } → the choice index, falling back to each option's default. */
function pickOptions(p: Product, opts: unknown): Sel {
  const sel = defaultSel(p);
  if (typeof opts === 'string') opts = Object.fromEntries(opts.split(/[,;]/).map((kv) => kv.split(/[=:]/).map((x) => x.trim())).filter((kv) => kv.length === 2 && kv[0]));
  if (opts && typeof opts === 'object') {
    for (const o of p.options) {
      const want = s((opts as Record<string, unknown>)[o.key]).toLowerCase();
      if (!want) continue;
      const i = o.choices.findIndex(([label]) => label.toLowerCase().includes(want) || want.includes(label.toLowerCase().replace(/[^a-z0-9"]+/g, ' ').trim()));
      if (i >= 0) sel[o.key] = i;
    }
  }
  return validSel(p, sel) ? sel : defaultSel(p);
}

/* ═══════════ Gemini ═══════════ */

/* Tried in order. Each model has its own quota (the free tier allows only a few
   requests a minute per model), so when one is busy or used up the call moves
   to the next instead of dropping out of the conversation. */
// Flash-Lite first: about a second per reply, which is what makes a call feel live.
// Pro models are too slow for a phone turn (and have no free-tier quota at all).
const GEMINI_MODELS = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest'])];
/** Models that refused minimal thinking; they get a plain request from then on. */
const noMinimalThinking = new Set<string>();
/** model → when its quota is back (ms), from the "retry in Ns" Google sends with a 429. */
const coolingUntil = new Map<string, number>();

const MENU_TEXT = CATALOG.filter((p) => !p.gift)
  .map((p) => {
    const opts = p.options
      .filter((o) => o.key !== 'plan')
      .map((o) => `${o.key}: ${o.choices.map(([l, d]) => (d ? `${l.toLowerCase()} +${d}` : l.toLowerCase())).join(' / ')}`)
      .join('; ');
    const about = [p.meta, p.notes?.length ? `notes ${p.notes.join(', ')}` : '', p.desc].filter(Boolean).join('. ').toLowerCase();
    return `- ${p.id} | ${p.name} | Rs ${p.price}${opts ? ` | ${opts}` : ''}${about ? `\n  ${about}` : ''}`;
  })
  .join('\n');

const persona = (g: VoiceGender) => `You are ${agentName(g)}, answering the phone at brewns, a specialty coffee house in Lahore. You are on a live voice call: everything you write is spoken aloud by a text-to-speech voice, and the caller's words reach you through speech recognition.

How to sound like a real person on the phone:
- Keep each turn short: one to three sentences, usually under 35 words. Ask one question at a time and then stop talking.
- Talk, don't write. Contractions, warm and relaxed, the odd "sure", "lovely", "okay, got it". No lists, bullet points, headings, emoji, markdown, or URLs.
- Say prices as "fourteen fifty rupees" or "Rs 1,450", times as "8 PM", dates as "this Friday" or "the 12th of October".
- Speech recognition makes mistakes. If something sounds garbled or a number seems off, check it naturally ("sorry, was that four people or fourteen?") instead of guessing.
- Language: answer in the language the caller is using right now, and switch the moment they do.
  - English → natural English.
  - Urdu, whether it reaches you in Urdu script or Roman Urdu ("mujhe kal table chahiye") → natural spoken Urdu written in Urdu script, so the Urdu voice pronounces it properly. Speak like a friendly Lahori on the phone, not formal textbook Urdu: "جی بالکل! کتنے لوگ ہوں گے؟". Everyday English words people use in Urdu are fine as they are (ٹیبل، آرڈر، بکنگ، ڈیلیوری، برگر، لاٹے).
  - In Urdu, keep numbers, times and codes as digits (7 بجے، 4 لوگ، RES-4821) and prices as "Rs 1,350".
  - Menu item names can stay in English in either language.
- Greet with "Assalam-o-Alaikum" (or "وعلیکم السلام" in reply) only when they do.
- If they interrupt or change their mind, just go with it. Never repeat the whole conversation back.
- Don't say you're an AI unless asked; if asked, say so plainly and cheerfully.

What you can do:
1. Book a table (1 to 20 guests). Collect: name, mobile number, which counter, date, time, number of guests, and indoor, terrace or bar seating (default indoor). Seating is 7 AM to 8 PM; we close at 9 PM.
2. Book a party or event (8 to 120 guests): birthdays, corporate, private evenings. Same details plus the occasion. The events team calls back afterwards to plan food and decor.
3. Put food and coffee in the caller's website bag with add_to_bag. They check out on the site themselves, where they choose pickup or delivery and pay. You can't take payment over the phone.
4. Answer questions about the menu, prices, the three counters, hours, delivery and the club.

Booking rules:
- Ask for only what's missing, one or two details per turn. Ask for the mobile number near the end.
- Before calling a booking tool, read the key details back in one sentence and get a clear yes. Then call the tool.
  - Immediately after a table or party booking succeeds:
  1. Give the confirmation code slowly (e.g. "Done, your table's confirmed! Your code is RES-2320.")
  2. The booking tool reports whether it actually delivered the WhatsApp voucher. Only say it was sent when that result is true; otherwise say the voucher is ready to open and share from the WhatsApp button.
  3. Ask for their email or Gmail address so you can send the confirmation details.
- When the caller provides their email (e.g. "alex at gmail dot com", "my email is ..."):
  Call save_booking_email with their email and the code.
  Only say the email was sent when the tool result says confirmation_email_sent is true. Otherwise say the address is saved to the booking but email delivery is not configured.
- If the caller declines or has no email (says "no", "skip", "nah", "it's fine", "nahi"):
  Say "No problem at all! You can simply give your code or name when you arrive. Anything else I can help with?"
- If a tool returns an error, explain it simply and ask for what's needed. Never invent a code or say something is booked unless the tool succeeded.
- Never invent menu items, prices, origins, roast days or tasting notes; describe things only from the menu below, and pass the exact ids to add_to_bag. If they ask for something we don't make (a flat white, a Spanish latte), say so kindly and suggest the closest thing we do.
- Only add to the bag when the caller asks for it ("I'll have", "add", "order", "get me"). A question like "tell me about your coffee" is not an order: answer it, then ask if they'd like one.
- Mention the price total after adding. If they want delivery and name an area, give that area's fee and time from the facts below.
- When the caller says goodbye or is clearly done, say a short friendly goodbye and call end_call.

brewns facts:
- Counters (shop number for tools): 0 = MM Alam Road, Gulberg III (flagship); 1 = CCA, DHA Phase 5; 2 = Main Boulevard, Johar Town. All open every day, 7 AM to 9 PM.
- Delivery (area: fee, minutes): ${DELIVERY.areas.map(([a, , fee, min]) => `${spokenArea(a)}: Rs ${fee}, ${min} min`).join('; ')}. Free over Rs ${DELIVERY.freeOver.toLocaleString('en-US')}, minimum order Rs ${DELIVERY.min.toLocaleString('en-US')}.
- Tax: 16% on cash, 5% on card or JazzCash / Easypaisa.
- House coffee is Slow Roast, Colombian and Ethiopian beans, roasted weekly. Every shot 92°C for 27 seconds.
- brewns Club: a stamp for every drink (two before 9 AM), a free drink every ten, and a birthday drink.
- Founder: Hassan Baig, a software engineer from Lahore. Brand ambassador: Hania Aamir; her order is the iced matcha latte and a cinnamon roll.

Menu (id | name | price | options):
${MENU_TEXT}`;

const bookingProps = {
  name: { type: 'string', description: "Guest's name" },
  phone: { type: 'string', description: 'Pakistani mobile number, e.g. 03001234567' },
  email: { type: 'string', description: "Guest's email or Gmail address if already given; empty if none" },
  shop: { type: 'integer', description: '0 MM Alam Road, 1 DHA Phase 5, 2 Johar Town' },
  date: { type: 'string', description: 'YYYY-MM-DD, resolved from today in Lahore' },
  time: { type: 'string', description: 'HH:MM, 24-hour' },
  guests: { type: 'integer' },
  notes: { type: 'string', description: 'Anything else the caller asked for (high chair, cake, window seat); empty if none' },
};

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'reserve_table',
        description: 'Book a table after the caller has confirmed all the details you read back. Returns the confirmation code, or an error explaining what to fix.',
        parameters: {
          type: 'object',
          properties: { ...bookingProps, area: { type: 'string', enum: ['indoor', 'terrace', 'bar'] } },
          required: ['name', 'phone', 'shop', 'date', 'time', 'guests', 'area'],
        },
      },
      {
        name: 'book_party',
        description: 'Book a party or event (8 to 120 guests) after the caller has confirmed the details you read back. Returns the booking code, or an error.',
        parameters: {
          type: 'object',
          properties: { ...bookingProps, occasion: { type: 'string', description: 'e.g. Birthday party, Corporate gathering, Private evening' } },
          required: ['name', 'phone', 'shop', 'date', 'time', 'guests', 'occasion'],
        },
      },
      {
        name: 'save_booking_email',
        description: "Save the caller's email or Gmail address after a booking is confirmed to send confirmation details and store in their customer profile.",
        parameters: {
          type: 'object',
          properties: {
            email: { type: 'string', description: "The caller's email or Gmail address (e.g. alex@gmail.com)" },
            code: { type: 'string', description: 'The booking code (e.g. RES-2320 or PTY-1234), or empty if current booking' },
          },
          required: ['email'],
        },
      },
      {
        name: 'add_to_bag',
        description: "Add menu items to the caller's website bag, only when they ask to order. Use exact ids from the menu.",
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Exact menu id' },
                  qty: { type: 'integer' },
                  options: { type: 'string', description: 'Choices the caller asked for as key=label pairs, e.g. "milk=oat, size=16 oz"; empty for defaults' },
                },
                required: ['id', 'qty'],
              },
            },
          },
          required: ['items'],
        },
      },
      { name: 'end_call', description: 'Hang up after you have said goodbye.' },
    ],
  },
];

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

/** Tidy anything that would sound wrong read aloud. */
const speakable = (t: string) =>
  t
    .replace(/[*_#`>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();

type ToolOut = { content: string; isError?: boolean };

function replyAfterToolFailure(actions: VoiceAction[], outputs: ToolOut[], lang: VoiceLang) {
  const booking = actions.find((action) => action.type === 'RESERVE_TABLE' || action.type === 'BOOK_PARTY');
  if (booking?.type === 'RESERVE_TABLE') return lang === 'ur' ? `آپ کی ٹیبل بک ہو گئی ہے۔ کنفرمیشن کوڈ ${spokenCode(booking.data.code)} ہے۔ کیا میں مزید مدد کروں؟` : `You're all set. Your confirmation code is ${spokenCode(booking.data.code)}. Is there anything else I can help with?`;
  if (booking?.type === 'BOOK_PARTY') return lang === 'ur' ? `آپ کا ایونٹ بک ہو گیا ہے۔ کنفرمیشن کوڈ ${spokenCode(booking.data.code)} ہے۔ ایونٹس ٹیم آپ سے رابطہ کرے گی۔` : `Your party is booked. Your confirmation code is ${spokenCode(booking.data.code)}. Our events team will be in touch. Anything else?`;
  const bag = actions.find((action) => action.type === 'ADD_TO_BAG');
  if (bag?.type === 'ADD_TO_BAG') return lang === 'ur' ? `میں نے ${bag.data.items.map((item) => `${item.qty} ${titleCase(item.name)}`).join(' اور ')} آپ کے بیگ میں شامل کر دیا ہے، کل ${money(bag.data.total)}۔` : `I've added ${bag.data.items.map((item) => `${item.qty} ${titleCase(item.name)}`).join(' and ')} to your bag, for ${money(bag.data.total)}. Anything else?`;
  const email = actions.find((action) => action.type === 'SAVED_EMAIL');
  if (email?.type === 'SAVED_EMAIL') return email.data.sent
    ? lang === 'ur' ? `کنفرمیشن ${email.data.email} پر بھیج دی ہے۔ کیا میں مزید مدد کروں؟` : `I've sent the confirmation details to ${email.data.email}. Is there anything else I can help with?`
    : lang === 'ur' ? `آپ کا ای میل بکنگ کے ساتھ محفوظ ہے، لیکن کنفرمیشن ای میل نہیں بھیجی جا سکی۔` : `I've saved ${email.data.email} to your booking, but the confirmation email could not be delivered. Anything else?`;
  const failure = outputs.find((output) => output.isError);
  if (failure) return lang === 'ur' ? 'معذرت، میں یہ ابھی مکمل نہیں کر سکی۔ کیا آپ تفصیل دوبارہ بتائیں گے؟' : `I couldn't complete that just now. ${failure.content} Could you tell me what you'd like to do next?`;
  return lang === 'ur' ? 'معذرت، لائن میں مسئلہ آ گیا۔ کیا آپ ایک بار پھر کہیں گے؟' : 'Sorry, the line cut out for a moment. Could you say that again?';
}

/** Require an affirmative response; a "no, that is not right" must never book. */
const CONFIRM = /\b(yes|yeah|yep|yup|sure|ok|okay|correct|confirm|confirmed|go ahead|book it|do it|sounds good|haan|han|ji|jee|theek|thik|bilkul|zaroor|kar do|kar dein|kardo|kardein)\b|ہاں|جی|ٹھیک|بالکل|ضرور|کر دیں|کردیں/i;
const NOT_CONFIRM = /\b(no|nope|not|don't|do not|wait|hold on|change|instead|actually|cancel|wrong|never mind)\b|نہیں|نہ|مت|رکیں|غلط|بدل|تبدیل/i;
const ASKED_TO_CONFIRM = /\b(shall i (book|confirm|reserve|lock that in)|should i (book|confirm|reserve|lock it in)|would you like me to (book|confirm|reserve|go ahead)|do you want me to (book|reserve|confirm)|can i (go ahead|confirm|lock that in)|shall i go ahead|are you happy for me to (book|reserve|confirm)|does (that|everything) (all )?(look|sound) (right|good|correct|okay)|is (that|everything) (all )?(right|correct|okay)|confirm (it|this|the booking))\b|کیا میں.*(بک|کنفرم)/i;
const isClearConfirmation = (text: string) => !NOT_CONFIRM.test(text) && CONFIRM.test(text);

async function runTool(name: string, input: Record<string, unknown>, transcript: string, actions: VoiceAction[], previousAssistant = ''): Promise<ToolOut> {
  if (name === 'reserve_table' || name === 'book_party') {
    if (!isClearConfirmation(transcript)) {
      return { content: 'Not booked: the caller did not clearly confirm. Ask them to confirm the read-back or ask what they want changed.', isError: true };
    }
    if (!ASKED_TO_CONFIRM.test(previousAssistant)) {
      return { content: 'Not booked: read all booking details back to the caller and ask whether they want you to confirm before trying again.', isError: true };
    }
  }
  if (name === 'reserve_table') {
    const r = await saveReservation(input, transcript);
    if (!r.ok) return { content: r.error, isError: true };
    actions.push({ type: 'RESERVE_TABLE', data: r.value });
    const waUrl = getWhatsappDirectLink(r.value.phone, buildBookingWhatsappMessage(r.value));
    actions.push({ type: 'WHATSAPP_VOUCHER', data: { phone: r.value.phone, code: r.value.code, whatsappUrl: r.value.whatsappUrl || waUrl, sent: Boolean(r.value.whatsappSent) } });
    return { content: JSON.stringify({ booked: true, code: r.value.code, say_code_as: spokenCode(r.value.code), counter: LOC_TITLES[r.value.loc], date: spokenDate(r.value.date), time: spokenTime(r.value.time), guests: r.value.guests, whatsapp_sent: Boolean(r.value.whatsappSent), email_confirmation_sent: Boolean(r.value.emailSent), note: r.value.whatsappSent ? 'WhatsApp voucher sent.' : 'Automatic WhatsApp delivery did not complete. The voucher is ready to open and share using the supplied link.' }) };
  }
  if (name === 'book_party') {
    const r = await saveParty(input);
    if (!r.ok) return { content: r.error, isError: true };
    actions.push({ type: 'BOOK_PARTY', data: r.value });
    const waUrl = getWhatsappDirectLink(r.value.phone, buildBookingWhatsappMessage({ ...r.value, kind: 'party' }));
    actions.push({ type: 'WHATSAPP_VOUCHER', data: { phone: r.value.phone, code: r.value.code, whatsappUrl: r.value.whatsappUrl || waUrl, sent: Boolean(r.value.whatsappSent) } });
    return { content: JSON.stringify({ booked: true, code: r.value.code, say_code_as: spokenCode(r.value.code), counter: r.value.location, date: spokenDate(r.value.date), time: spokenTime(r.value.time), guests: r.value.guests, whatsapp_sent: Boolean(r.value.whatsappSent), email_confirmation_sent: Boolean(r.value.emailSent), note: r.value.whatsappSent ? 'WhatsApp voucher sent.' : 'Automatic WhatsApp delivery did not complete. The voucher is ready to open and share using the supplied link.' }) };
  }
  if (name === 'save_booking_email') {
    const emailStr = String(input.email || '');
    const codeStr = String(input.code || '');
    const clean = parseEmail(emailStr);
    if (!clean) return { content: 'That does not look like a valid email address. Ask the caller to repeat it.', isError: true };
    const r = await attachEmailToBooking(clean, extractBookingCode(codeStr) || codeStr);
    if (r.ok) {
      actions.push({ type: 'SAVED_EMAIL', data: { email: clean, code: r.code, sent: Boolean(r.sent) } });
      return { content: JSON.stringify({ saved: true, email: clean, code: r.code, confirmation_email_sent: Boolean(r.sent), note: r.sent ? 'Confirmation email sent and linked to the booking.' : 'Email saved to booking, but the confirmation email was not delivered. Do not say an email was sent.' }) };
    }
    return { content: 'No booking matched that email and confirmation code. Do not say the email was saved or sent; ask the caller to repeat their booking code.', isError: true };
  }
  if (name === 'add_to_bag') {
    const r = checkBag(input.items);
    if (!r.ok) return { content: r.error, isError: true };
    actions.push({ type: 'ADD_TO_BAG', data: r.value });
    return { content: JSON.stringify({ added: r.value.items.map((l) => `${l.qty} × ${titleCase(l.name)}`), total: money(r.value.total), note: 'Tax and any delivery fee are added at checkout on the website.' }) };
  }
  if (name === 'end_call') {
    actions.push({ type: 'END_CALL' });
    return { content: 'ok' };
  }
  return { content: `Unknown tool ${name}`, isError: true };
}

const BYE = /\b(bye|goodbye|that's all|thats all|nothing else|no thanks|khuda hafiz|allah hafiz)\b/i;

type GeminiPart = { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thoughtSignature?: string };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
type GeminiBody = { generationConfig: Record<string, unknown>; [key: string]: unknown };

async function gemini(body: GeminiBody, model: string): Promise<{ parts: GeminiPart[]; finish?: string; blocked?: string }> {
  // Least thinking = quickest reply; models differ in what they accept, so fall back to their default.
  const minimal = !noMinimalThinking.has(model);
  const payload = minimal ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: 'minimal' } } } : body;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message || res.statusText;
    if (res.status === 400 && minimal && /thinking|invalid argument/i.test(msg)) {
      noMinimalThinking.add(model);
      return gemini(body, model);
    }
    if (res.status === 429) {
      const wait = Number(msg.match(/retry in ([\d.]+)s/i)?.[1] || 60);
      coolingUntil.set(model, Date.now() + wait * 1000);
    }
    throw Object.assign(new Error(`Gemini ${model} ${res.status}: ${msg.split('\n')[0]}`), { status: res.status });
  }
  const c = data.candidates?.[0];
  return { parts: c?.content?.parts || [], finish: c?.finishReason, blocked: data.promptFeedback?.blockReason };
}

/** One request, moving down the model list on a busy (503) or used-up (429) model. */
async function geminiAny(body: GeminiBody, stick: { model?: string }) {
  const order = stick.model ? [stick.model, ...GEMINI_MODELS.filter((m) => m !== stick.model)] : GEMINI_MODELS;
  const ready = order.filter((m) => (coolingUntil.get(m) || 0) < Date.now());
  let last: unknown = new Error('Every Gemini model is out of quota right now.');
  for (const model of ready.length ? ready : order) {
    try {
      const r = await gemini(body, model);
      // Tool results must go back to the model that asked for them.
      stick.model = model;
      return r;
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      // Busy, out of quota, gone, or too slow: try the next model.
      if (status && ![400, 403, 404, 429, 500, 503].includes(status)) throw err;
      if (stick.model === model) delete stick.model;
    }
  }
  throw last;
}

async function geminiTurn(prompt: string, history: VoiceTurn[], gender: VoiceGender, lang: VoiceLang): Promise<{ reply: string; actions: VoiceAction[] }> {
  const now = lahoreNow();
  const contents: GeminiContent[] = [];
  // Turns start with the caller; the greeting is folded in as context.
  for (const t of history) {
    if (!contents.length && t.role === 'assistant') contents.push({ role: 'user', parts: [{ text: '(call connected)' }] });
    contents.push({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const actions: VoiceAction[] = [];
  const spoken: string[] = [];
  const stick: { model?: string } = {};

  for (let hop = 0; hop < 4; hop++) {
    const res = await geminiAny({
      systemInstruction: { parts: [{ text: `${persona(gender)}\n\nRight now in Lahore it is ${now.weekday} ${now.date}, ${now.clock}.\nThe caller's latest line is in ${lang === 'ur' ? 'Urdu: reply in Urdu script' : 'English: reply in English'}.` }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }, stick);

    if (res.blocked || res.finish === 'SAFETY' || res.finish === 'PROHIBITED_CONTENT') {
      return { reply: "Sorry, I can't help with that one. Is there anything about a table, a party or your order I can do for you?", actions };
    }

    for (const part of res.parts) if (part.text?.trim() && !part.thought) spoken.push(part.text);
    const calls = res.parts.filter((part) => part.functionCall);
    if (!calls.length) break;

    // Send the model's turn back as it came (thought signatures included), then the results.
    contents.push({ role: 'model', parts: res.parts });
    const responses: GeminiPart[] = [];
    for (const c of calls) {
      const { name, args } = c.functionCall!;
      const previousAssistant = [...history].reverse().find((turn) => turn.role === 'assistant')?.content || '';
      const out = await runTool(name, args || {}, prompt, actions, previousAssistant);
      responses.push({ functionResponse: { name, response: out.isError ? { error: out.content } : { result: out.content } } });
    }
    contents.push({ role: 'user', parts: responses });
    // Hanging up needs no further words once the goodbye is said.
    if (calls.every((c) => c.functionCall!.name === 'end_call') && spoken.length) break;
  }

  // The caller said goodbye and so did the model, but it forgot to hang up.
  if (!actions.some((a) => a.type === 'END_CALL') && BYE.test(prompt) && /\b(bye|take care|khuda hafiz|allah hafiz|have a (lovely|great|good))\b/i.test(spoken.join(' '))) actions.push({ type: 'END_CALL' });
  const reply = speakable(spoken.join(' ')) || (actions.some((a) => a.type === 'END_CALL') ? 'Thanks for calling brewns. Take care!' : 'Sorry, could you say that again?');
  return { reply, actions };
}

/* ═══════════ Groq ═══════════ */

export const groqEnabled = () => Boolean(process.env.GROQ_API_KEY);
const GROQ_MODELS = [...new Set([process.env.GROQ_MODEL || 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'])];

const GROQ_TOOLS = TOOLS[0].functionDeclarations.map((fn) => ({
  type: 'function',
  function: {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  },
}));

async function groqTurn(
  prompt: string,
  history: VoiceTurn[],
  gender: VoiceGender,
  lang: VoiceLang,
): Promise<{ reply: string; actions: VoiceAction[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('No Groq API key');

  const now = lahoreNow();
  const languageInstruction = lang === 'ur'
    ? 'The caller is speaking Urdu. Reply in natural conversational Urdu written in Urdu script; preserve menu names, email addresses, and booking codes clearly.'
    : 'Reply in natural conversational English. If the caller switches to Urdu, follow their language.';
  const systemPrompt =
    persona(gender) +
    `\nCurrent time in Lahore: ${now.clock}, date: ${now.date}.\n${languageInstruction}\nMenu items:\n${MENU_TEXT}\nIMPORTANT: Keep answers short (1 to 2 spoken sentences, usually under 35 words). Never use markdown, bullet points, headings, or emojis. Call tools when reserving a table, party, saving email, or ordering.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: prompt },
  ];

  const actions: VoiceAction[] = [];
  const previousAssistant = [...history].reverse().find((turn) => turn.role === 'assistant')?.content || '';

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          tools: GROQ_TOOLS,
          tool_choice: 'auto',
          max_tokens: 350,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(6500),
      });

      if (!res.ok) {
        console.warn(`[Voice Groq ${model} ${res.status}]`, await res.text().catch(() => ''));
        continue;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;
      if (!message) continue;

      // Handle function tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);
        const toolOutputs: ToolOut[] = [];
        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown> = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {}

          const toolOut = await runTool(fnName, fnArgs, prompt, actions, previousAssistant);
          toolOutputs.push(toolOut);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolOut.content,
          });
        }

        // Send tool results back to Groq for spoken confirmation sentence
        try {
          const secondRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 220, temperature: 0.7 }),
            signal: AbortSignal.timeout(6500),
          });
          if (secondRes.ok) {
            const secondData = await secondRes.json();
            const secondContent = secondData.choices?.[0]?.message?.content?.trim();
            if (secondContent) {
              const reply = speakable(secondContent);
              if (BYE.test(prompt) && /\b(bye|take care|khuda hafiz|allah hafiz)\b/i.test(reply)) actions.push({ type: 'END_CALL' });
              return { reply, actions };
            }
          } else {
            console.warn(`[Voice Groq ${model} tool follow-up ${secondRes.status}]`, (await secondRes.text().catch(() => '')).slice(0, 300));
          }
        } catch (error) {
          console.warn(`[Voice Groq ${model} tool follow-up]`, error instanceof Error ? error.message : error);
        }
        // Tools may already have written to the booking store or bag. Never retry
        // the original model request after that, or a second provider may repeat it.
        return { reply: replyAfterToolFailure(actions, toolOutputs, lang), actions };
      }

      const content = message.content?.trim();
      if (content) {
        let reply = speakable(content);
        if (BYE.test(prompt) && /\b(bye|take care|khuda hafiz|allah hafiz|have a (lovely|great|good))\b/i.test(reply)) {
          actions.push({ type: 'END_CALL' });
        }
        return { reply, actions };
      }
    } catch (e) {
      console.warn(`[Voice Groq ${model}]`, e instanceof Error ? e.message : e);
    }
  }
  throw new Error('Every Groq model failed or is out of quota.');
}

/* ═══════════ the script, when there is no Gemini key ═══════════ */

const QUESTIONS: Record<string, (flow: 'table' | 'party') => string> = {
  occasion: () => "Lovely! What's the occasion? A birthday, something for work, or a private evening?",
  loc: () => 'Which counter would suit you: MM Alam Road in Gulberg, DHA Phase 5, or Johar Town?',
  date: () => 'And which day are you thinking?',
  time: () => 'What time would you like? We seat from 7 in the morning until 8 at night.',
  guests: (f) => (f === 'party' ? 'Roughly how many guests are you expecting?' : 'How many people will it be?'),
  area: () => 'Would you like indoor seating, the terrace, or at the bar?',
  name: () => 'What name should I put it under?',
  phone: () => "And a mobile number, in case we need to reach you?",
};

const ORDER: Record<'table' | 'party', string[]> = {
  table: ['loc', 'date', 'time', 'guests', 'area', 'name', 'phone'],
  party: ['occasion', 'loc', 'date', 'guests', 'time', 'name', 'phone'],
};

/** Pull whatever booking details the caller just said into the slots. */
function fillSlots(p: string, raw: string, st: ScriptState, asked?: string) {
  const sl = (st.slots ||= {});
  const loc = parseShop(p);
  if (loc >= 0) sl.loc = String(loc);
  const date = parseDate(p);
  if (date) sl.date = date;
  const g = p.match(/\b(\d{1,3})\s*(people|guests|persons|pax|log|of us|friends|adults)\b/);
  const forN = p.match(/\b(?:table|party|booking|seats?) for (\d{1,3}|two|three|four|five|six|seven|eight|nine|ten)\b(?!\s*(?::\d|am|pm))/);
  const WORD_N: Record<string, string> = { two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
  if (g) sl.guests = g[1];
  else if (forN) sl.guests = WORD_N[forN[1]] || forN[1];
  else if (asked === 'guests') {
    const n = p.match(/\b(\d{1,3})\b/) || [null, String(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].findIndex((w) => new RegExp(`\\b${w}\\b`).test(p)))];
    if (n[1] && n[1] !== '-1') sl.guests = n[1];
  }
  const t = parseTime(p.replace(/\b\d{1,3}\s*(people|guests|persons|pax|log|of us|friends|adults)\b/g, ''));
  if (t >= 0 && (asked === 'time' || /\d\s*(am|pm|a\.m|p\.m)|\d:\d\d|\b(at|around|by|about)\s+\d|morning|afternoon|evening|lunch|dinner|tonight|baje|shaam|raat|subah/.test(p))) sl.time = hhmm(t);
  if (/\bterrace\b/.test(p)) sl.area = 'terrace';
  else if (/\bbar\b/.test(p)) sl.area = 'bar';
  else if (/\b(indoor|inside|anywhere|doesn.t matter|no preference)\b/.test(p) || asked === 'area') sl.area ||= 'indoor';
  if (/birthday|salgirah/.test(p)) sl.occasion = 'Birthday party';
  else if (/corporate|office|work|team|company/.test(p)) sl.occasion = 'Corporate gathering';
  else if (/wedding|mehndi|engagement|nikah/.test(p)) sl.occasion = 'Wedding event';
  else if (asked === 'occasion' && p.length > 1) sl.occasion = raw.slice(0, 40);
  const phone = pkMobile(p.replace(/[^\d+]/g, ''));
  if (phone) sl.phone = phone;
  const nm = raw.match(/\b(?:my name is|name is|this is|i am|i'm|it's under|under the name|under)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/i);
  if (nm && !/^(a|an|the|looking|calling|here|not)\b/i.test(nm[1])) sl.name = nm[1];
  else if (asked === 'name' && /^[a-z][a-z' -]{1,40}$/i.test(raw.trim()) && !/\b(inside|indoor|terrace|bar|yes|no|okay|ok|sure|sorry|what|hello|hi)\b/i.test(raw)) sl.name = raw.trim();
  if (sl.name) sl.name = sl.name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function readBack(st: ScriptState) {
  const sl = st.slots || {};
  const where = LOC_TITLES[Number(sl.loc)];
  const when = `${spokenDate(sl.date!)} at ${spokenTime(sl.time!)}`;
  return st.flow === 'party'
    ? `So that's a ${sl.occasion?.toLowerCase()} for ${sl.guests} guests at ${where}, ${when}, under ${sl.name}, number ${sl.phone}. Shall I book it?`
    : `Let me read that back: a table for ${sl.guests} at ${where}, ${when}, ${sl.area} seating, under ${sl.name}, on ${sl.phone}. Shall I confirm it?`;
}

async function scriptBooking(p: string, raw: string, st: ScriptState, fresh = false): Promise<{ reply: string; actions: VoiceAction[]; state: ScriptState }> {
  const flow = st.flow || 'table';
  const actions: VoiceAction[] = [];

  if (st.waitingForEmail) {
    const code = st.confirmedCode || '';
    const kind = st.confirmedKind || flow;
    const email = parseEmail(raw);
    if (email) {
      const result = await attachEmailToBooking(email, code, kind);
      if (!result.ok) {
        return { reply: 'I could not find that booking code. Could you repeat the code so I can attach your email to the right reservation?', actions, state: st };
      }
      actions.push({ type: 'SAVED_EMAIL', data: { email, code: result.code, sent: Boolean(result.sent) } });
      const isUrduLang = /[\u0600-\u06FF]/.test(raw) || /^(ji|shukriya|meherbani)\b/i.test(p);
      const reply = result.sent
        ? isUrduLang
          ? `بہت شکریہ! ہم نے کنفرمیشن ${email} پر بھیج دی ہے۔ کیا میں مزید کچھ مدد کر سکتی ہوں؟`
          : `Lovely, I've sent the confirmation details to ${email}. See you then! Anything else I can help with?`
        : isUrduLang
          ? `آپ کا ای میل بکنگ کے ساتھ محفوظ ہو گیا ہے، لیکن کنفرمیشن ای میل نہیں بھیجی جا سکی۔ کیا میں مزید مدد کر سکتی ہوں؟`
          : `I've saved ${email} to your booking, but the confirmation email could not be delivered. Is there anything else I can help with?`;
      return { reply, actions, state: {} };
    }
    if (/\b(no|nope|skip|don'?t have|not now|nahi|nah|none|never mind|that'?s all|leave it|ok|okay)\b/i.test(p) || BYE.test(p)) {
      const isUrduLang = /[\u0600-\u06FF]/.test(raw) || /^(nahi|nahin|theek)\b/i.test(p);
      const reply = isUrduLang
        ? `کوئی مسئلہ نہیں! آپ پہنچ کر کوڈ ${spokenCode(code)} دکھا سکتے ہیں۔ کیا میں مزید کچھ مدد کر سکتی ہوں؟`
        : `No problem at all! You can simply give your name or code ${spokenCode(code)} when you arrive. Anything else I can help with?`;
      return { reply, actions, state: {} };
    }
    // If they ask for something else, clear waitingForEmail and fall through to rest of turn
    delete st.waitingForEmail;
  }

  if (st.confirming) {
    if (isClearConfirmation(raw)) {
      const sl = st.slots || {};
      const input = { name: sl.name, phone: sl.phone, email: sl.email, shop: Number(sl.loc), date: sl.date, time: sl.time, guests: Number(sl.guests), area: sl.area, occasion: sl.occasion, notes: '' };
      const r = flow === 'party' ? await saveParty(input) : await saveReservation(input, raw);
      if (!r.ok) return { reply: `Hmm, I couldn't book that: ${r.error} Could you give me a different one?`, actions, state: { flow, slots: sl } };
      actions.push(flow === 'party' ? { type: 'BOOK_PARTY', data: r.value as PartyBooking } : { type: 'RESERVE_TABLE', data: r.value as Reservation });
      const waUrl = getWhatsappDirectLink(sl.phone || '', buildBookingWhatsappMessage({
        code: r.value.code,
        name: sl.name || '',
        phone: sl.phone || '',
        loc: Number(sl.loc || 0),
        date: sl.date || '',
        time: sl.time || '',
        guests: Number(sl.guests || 2),
        area: sl.area,
        kind: flow,
      }));
      actions.push({ type: 'WHATSAPP_VOUCHER', data: { phone: sl.phone || '', code: r.value.code, whatsappUrl: r.value.whatsappUrl || waUrl, sent: Boolean(r.value.whatsappSent) } });
      const code = r.value.code;
      const isUrduLang = /[\u0600-\u06FF]/.test(raw) || /^(haan|han|ji|jee|theek|bilkul)\b/i.test(p);
      const voucherNotice = r.value.whatsappSent
        ? isUrduLang ? 'ہم نے بکنگ واؤچر واٹس ایپ پر بھیج دیا ہے۔' : `I've sent the voucher to your WhatsApp on ${forSpeech(sl.phone || '')}.`
        : isUrduLang ? 'واٹس ایپ پر واؤچر خودکار طور پر نہیں بھیجا جا سکا، مگر شیئر کرنے کے لیے تیار ہے۔' : 'WhatsApp did not send automatically, but your voucher is ready to share from the button.';
      const reply = isUrduLang
        ? (flow === 'party'
            ? `آپ کا ایونٹ بک ہو گیا ہے! آپ کا کوڈ ${spokenCode(code)} ہے۔ ${voucherNotice} کیا آپ اپنا ای میل یا جی میل بتا سکتے ہیں؟`
            : `آپ کی ٹیبل بک ہو گئی ہے! آپ کا کوڈ ${spokenCode(code)} ہے۔ ${voucherNotice} کیا آپ اپنا ای میل یا جی میل بتا سکتے ہیں؟`)
        : (flow === 'party'
            ? `You're all booked! Your code is ${spokenCode(code)}. ${voucherNotice} What's your email or Gmail address?`
            : `Done, your table's confirmed! Your code is ${spokenCode(code)}. ${voucherNotice} What's your email or Gmail address?`);
      return { reply, actions, state: { flow, waitingForEmail: true, confirmedCode: code, confirmedKind: flow } };
    }
    if (/\b(no|nope|wrong|change|not right|nahi|actually|make it)\b/.test(p)) {
      const was = JSON.stringify(st.slots || {});
      fillSlots(p, raw, st);
      if (JSON.stringify(st.slots) !== was) return { reply: `Sure, changed. ${readBack(st)}`, actions, state: { ...st, confirming: true } };
      return { reply: 'No problem, what should I change?', actions, state: { ...st, confirming: false } };
    }
  }

  const before = JSON.stringify(st.slots || {});
  // On the opening line nothing has been asked yet, so a bare answer can't be matched to a question.
  const lastAsked = fresh ? undefined : ORDER[flow].find((k) => !st.slots?.[k as keyof NonNullable<ScriptState['slots']>]);
  fillSlots(p, raw, st, lastAsked);

  // Check what's been given so far, so a bad date or time is caught right away.
  const sl = st.slots!;
  if (sl.date && sl.date < lahoreNow().date) delete sl.date;
  if (sl.time) {
    const m = Number(sl.time.slice(0, 2)) * 60 + Number(sl.time.slice(3));
    if (m < OPEN_MIN || m > CLOSE_MIN - 60) {
      delete sl.time;
      return { reply: `Ah, we only seat between 7 AM and 8 PM, as we close at 9. What time in that window works?`, actions, state: st };
    }
  }

  const next = ORDER[flow].find((k) => !sl[k as keyof typeof sl]);
  if (!next) return { reply: readBack(st), actions, state: { ...st, confirming: true } };
  const progressed = JSON.stringify(sl) !== before;
  const ack = fresh ? '' : progressed ? ['Okay. ', 'Got it. ', 'Great. ', 'Lovely. '][Object.keys(sl).length % 4] : lastAsked === next && p ? "Sorry, I didn't quite catch that. " : '';
  return { reply: ack + QUESTIONS[next](flow), actions, state: st };
}

/* [pattern, menu id, generic]: a generic word ("burger") only counts when no
   specific dish of that kind ("zinger burger") was named. */
const WORDS: [RegExp, string, boolean?][] = [
  [/smash/, 'smash-burger'], [/zinger/, 'zinger-burger'], [/bbq|barbecue/, 'bbq-burger'], [/burger/, 'smash-burger', true],
  [/alfredo/, 'alfredo-pasta'], [/arrabbiata|arabiata/, 'arrabbiata-pasta'], [/pesto/, 'pesto-pasta'], [/pasta/, 'alfredo-pasta', true],
  [/tikka/, 'tikka-roll'], [/behari/, 'behari-roll'], [/wrap/, 'crispy-wrap'],
  [/margherita/, 'margherita-pizza'], [/fajita/, 'fajita-pizza'], [/pepperoni/, 'pepperoni-pizza'], [/pizza/, 'pepperoni-pizza', true],
  [/mint margarita|margarita/, 'mint-margarita'], [/peach|iced tea/, 'peach-iced-tea'], [/mango|smoothie/, 'mango-smoothie'], [/lime|soda/, 'lime-soda'],
  [/iced latte/, 'iced-latte'], [/matcha latte|iced matcha|matcha(?! financier)/, 'iced-matcha'], [/latte/, 'latte', true], [/espresso/, 'espresso'], [/cortado/, 'cortado'], [/cold brew|nitro/, 'nitro-cold-brew'],
  [/cardamom|bun/, 'cardamom-bun'], [/cinnamon/, 'cinnamon-roll'], [/financier/, 'matcha-financier'],
  [/slow roast|beans|house blend/, 'slow-roast'], [/single origin/, 'single-origin'], [/tumbler/, 'ceramic-tumbler'],
];
const NUMS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, do: 2, teen: 3 };

/** "DHA Phase 5" → the matching delivery area, or null. */
function deliveryArea(p: string) {
  const want = /\bdha\b.*\b(7|8|seven|eight)\b/.test(p) ? 'DHA PHASE 7–8' : /\b(dha|defence|defense)\b/.test(p) ? 'DHA PHASE 1–6' : /model town/.test(p) ? 'MODEL TOWN' : /garden town/.test(p) ? 'GARDEN TOWN' : /wapda/.test(p) ? 'WAPDA TOWN' : /johar/.test(p) ? 'JOHAR TOWN' : /gulberg|mm alam/.test(p) ? 'GULBERG' : '';
  return DELIVERY.areas.find(([a]) => a === want) || null;
}

const menuNames = (cat: string, n = 4) => CATALOG.filter((x) => x.cat === cat).slice(0, n).map((x) => titleCase(x.name));
const sayList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');

/** A spoken description of one dish or drink, straight from the catalog. */
function describe(id: string) {
  const p = catalogItem(id)!;
  const first = (p.desc || '').split(/(?<=\.)\s/)[0];
  const notes = p.notes?.length ? ` It tastes ${sayList(p.notes.map((n) => n.toLowerCase()))}.` : '';
  return `The ${titleCase(p.name)} is ${money(p.price)}. ${first}${notes}`;
}

const COFFEE_TALK = () => {
  const house = catalogItem('slow-roast')!;
  const so = catalogItem('single-origin')!;
  return `Coffee's our thing! Everything starts with Slow Roast, our house roast, with notes of ${sayList((house.notes || []).map((n) => n.toLowerCase()))}. We also have a single origin ${titleCase(so.name)}, bright with ${sayList((so.notes || []).map((n) => n.toLowerCase()))}. At the bar there's ${sayList(menuNames('drinks', 6).map((n) => n.toLowerCase()))}. Do you like it strong, milky, or cold?`;
};

/** Pick up a booking the AI was in the middle of, from what the caller has said so far. */
function stateFromHistory(history: VoiceTurn[]): ScriptState {
  let st: ScriptState = {};
  for (const t of history) {
    if (t.role === 'assistant') {
      if (/email|gmail/i.test(t.content) && (/\b(RES|PTY)\b|R E S|P T Y|code is/i.test(t.content))) {
        const normCode = extractBookingCode(t.content) || '';
        const kind = /party|ایونٹ/i.test(t.content) ? 'party' : 'table';
        st = { flow: kind, waitingForEmail: true, confirmedCode: normCode, confirmedKind: kind };
        continue;
      }
      // A code read out means that booking is done; anything after is a new request.
      if (/\b(RES|PTY)\b|R E S|P T Y|code is/i.test(t.content)) st = {};
      continue;
    }
    const p = t.content.toLowerCase();
    if (st.waitingForEmail) {
      const email = parseEmail(t.content);
      if (email || /\b(no|nope|skip|nahi|nah)\b/i.test(p)) {
        st = {};
        continue;
      }
    }
    if (!st.flow) {
      if (/party|event|birthday|celebrat|gathering|corporate|salgirah/.test(p)) st = { flow: 'party', slots: {} };
      else if (/\b(table|reserve|reservation|book|seat|jagah)\b/.test(p)) st = { flow: 'table', slots: {} };
      else continue;
      fillSlots(p, t.content, st);
    } else {
      fillSlots(p, t.content, st, ORDER[st.flow].find((k) => !st.slots?.[k as keyof NonNullable<ScriptState['slots']>]));
    }
  }
  return st;
}

async function scriptTurn(prompt: string, gender: VoiceGender, state: ScriptState, history: VoiceTurn[] = []): Promise<{ reply: string; actions: VoiceAction[]; state: ScriptState }> {
  if (!state.flow && !state.waitingForEmail && history.length) state = stateFromHistory(history);
  const r = await scriptAnswer(prompt, gender, state);
  // Answer a salam in kind, whatever else was asked in the same breath.
  if (/\b(a?s+alam|salaam|aoa)\b/i.test(prompt) && !/alaikum assalam/i.test(r.reply)) r.reply = `Wa alaikum assalam! ${r.reply.replace(/^(Hi there!|Sure!|Happy to!)\s*/, '')}`;
  return r;
}

async function scriptAnswer(prompt: string, gender: VoiceGender, state: ScriptState): Promise<{ reply: string; actions: VoiceAction[]; state: ScriptState }> {
  const raw = prompt.trim();
  const p = raw.toLowerCase();
  const name = agentName(gender);

  if (state.flow || state.waitingForEmail) {
    if (/\b(cancel|never ?mind|forget it|stop|start over)\b/.test(p)) return { reply: 'No worries, I\'ve dropped that. What else can I do for you?', actions: [], state: {} };
    return scriptBooking(p, raw, state);
  }

  if (BYE.test(p))
    return { reply: 'Thanks for calling brewns. Have a lovely day!', actions: [{ type: 'END_CALL' }], state: {} };

  if (/party|event|birthday|celebrat|gathering|corporate|salgirah/.test(p)) {
    const st: ScriptState = { flow: 'party', slots: {} };
    fillSlots(p, raw, st);
    const r = await scriptBooking(p, raw, st, true);
    return { ...r, reply: `Oh, how exciting! ${r.reply}` };
  }
  if (/\b(table|reserve|reservation|book|seat|jagah)\b/.test(p)) {
    const st: ScriptState = { flow: 'table', slots: {} };
    fillSlots(p, raw, st);
    const r = await scriptBooking(p, raw, st, true);
    return { ...r, reply: `Sure, I can help with that. ${r.reply}` };
  }

  const found = new Map<string, number>();
  let rest = p;
  for (const [re, id, generic] of WORDS) {
    const kind = id.split('-').pop()!;
    if (generic && [...found.keys()].some((k) => k.endsWith(kind))) continue;
    const m = rest.match(new RegExp(`\\b(?:${re.source})[a-z]*(?:\\s+(?:burgers?|pizzas?|pastas?|rolls?|lattes?))?`));
    if (!m || m.index === undefined) continue;
    // The quantity is the nearest number word in the two words before the dish.
    const before = rest.slice(0, m.index).trim().split(/\s+/).slice(-3);
    const q = before.reverse().find((w) => /^\d+$/.test(w) || w in NUMS);
    found.set(id, (found.get(id) || 0) + (q ? Number(q) || NUMS[q] : 1));
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
  }
  // A question about a dish is not an order: describe it, and let them decide.
  const asking = /\b(tell me|about|what('s| is| are|s)|how much|price|cost|describe|difference|recommend|suggest|kya hai|kaisa|taste|like)\b|\?$/.test(p);
  const ordering = /\b(order|add|get me|can i (get|have)|i('ll| will)? ?(have|take)|i want|i'd like|give me|send|deliver|bhej|chahiye|please)\b/.test(p);
  if (asking && !ordering) {
    if (found.size) return { reply: `${sayList([...found.keys()].slice(0, 2).map(describe))} Would you like me to add it?`, actions: [], state: {} };
    if (/coffee|beans|roast|espresso|brew/.test(p)) return { reply: COFFEE_TALK(), actions: [], state: {} };
  }

  if (found.size) {
    const r = checkBag([...found].map(([id, qty]) => ({ id, qty })));
    if (r.ok) {
      const said = r.value.items.map((l) => (l.qty > 1 ? `${l.qty} ${titleCase(l.name)}s` : withArticle(titleCase(l.name)))).join(' and ');
      const area = /deliver|delivery|send|bhej|home/.test(p) ? deliveryArea(p) : null;
      const fee = area ? (r.value.total >= DELIVERY.freeOver ? 0 : area[2]) : 0;
      const how = area
        ? `Delivery to ${spokenArea(area[0])} is ${fee ? money(fee) : 'free on this order'} and takes about ${area[3]} minutes${r.value.total < DELIVERY.min ? `, with a ${money(DELIVERY.min)} minimum` : ''}; just pick delivery at checkout.`
        : /deliver|delivery/.test(p)
          ? 'Pick delivery at checkout and add your address. Which area are you in?'
          : 'You can choose pickup or delivery at checkout.';
      return {
        reply: `Sure! I've put ${said} in your bag, that's ${money(r.value.total)}. ${how} Anything else?`,
        actions: [{ type: 'ADD_TO_BAG', data: r.value }],
        state: {},
      };
    }
  }
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  if (/menu|what (do you have|is available|you have)|available|serve/.test(p)) {
    const specials = [
      `Our bar is pouring fresh ${sayList(menuNames('drinks', 4).map((n) => n.toLowerCase()))}. From the kitchen we have smash burgers, wood-fired pizza, pasta and flaky pastries. What are you craving?`,
      `We have a full specialty line: hot espresso drinks, iced matcha, refreshers, plus gourmet burgers, wood-fired pizza and fresh bakery items. Are you looking for coffee, food, or a sweet treat?`,
      `Lots of favorites today! Barista specials include our iced matcha latte and nitro cold brew, alongside classic smash burgers and pasta. Can I tell you about anything specific?`,
    ];
    return { reply: pick(specials), actions: [], state: {} };
  }
  if (/coffee|beans|roast/.test(p)) return { reply: COFFEE_TALK(), actions: [], state: {} };
  if (/order|deliver|hungry|eat|drink/.test(p)) {
    const orderReplies = [
      'Happy to help with that! We have smash burgers, wood-fired pizza, fresh pasta, paratha rolls, and specialty coffee. What would you like to get started with?',
      'You got it! You can order burgers, pizza, pasta, rolls or iced coffee right now. What sounds good to you?',
      'Sure thing! Fresh from our kitchen we have burgers, pizza, pasta and artisan drinks. What can I add to your bag?',
    ];
    return { reply: pick(orderReplies), actions: [], state: {} };
  }
  if (/hour|open|close|timing|time/.test(p)) {
    const hourReplies = [
      "All three counters are open daily from 7 AM to 9 PM, with kitchen and seating from 7 AM to 8 PM. Would you like me to reserve a table for you?",
      "We're open every day, 7 in the morning till 9 at night! Would you like to book a table at Gulberg, DHA, or Johar Town?",
      "Our doors are open 7 AM to 9 PM daily across all three locations. Can I set up a table for you today?",
    ];
    return { reply: pick(hourReplies), actions: [], state: {} };
  }
  if (/where|location|address|branch|counter/.test(p)) {
    const locReplies = [
      "We're on MM Alam Road in Gulberg III, in CCA DHA Phase 5, and on Main Boulevard in Johar Town. Which counter is most convenient for you?",
      "You can visit us in Gulberg on MM Alam, in DHA Phase 5 CCA, or in Johar Town on Main Boulevard. Looking to dine in or pick up?",
      "We have three shops in Lahore: Gulberg MM Alam, DHA Phase 5, and Johar Town. Which one would you like to visit?",
    ];
    return { reply: pick(locReplies), actions: [], state: {} };
  }
  if (/hassan|founder|owner|story/.test(p))
    return { reply: 'brewns was started by Hassan Baig, a software engineer from Lahore who wanted great coffee without the queue. He even built this website himself!', actions: [], state: {} };
  if (/hania|ambassador/.test(p))
    return { reply: "Hania Aamir is our brand ambassador! Her usual is an iced matcha latte with a cinnamon roll. Want me to add that for you?", actions: [], state: {} };
  if (/\b(hi|hello|hey|a?s+alam|salaam|aoa)\b/.test(p) || !p) {
    const greetingsList = [
      `Hi there! This is ${name} at brewns. How can I help you today?`,
      `Hello! ${name} here at brewns concierge. What can I do for you?`,
      `Hey! Thanks for reaching out to brewns. This is ${name}. How may I assist you?`,
      `Assalam-o-Alaikum! ${name} from brewns here. Table booking, party, or an order — what's on your mind?`,
    ];
    return { reply: pick(greetingsList), actions: [], state: {} };
  }
  const helpReplies = [
    "I can book you a table, arrange a private party, or put food and coffee straight into your bag. What would you like?",
    "I'm here to help with reservations, private events, or ordering from the menu. Which can I do for you?",
    "Whether you'd like a table reservation, an event booking, or a coffee delivery, just let me know!",
  ];
  return { reply: pick(helpReplies), actions: [], state: {} };
}

function getLahoreHour(): number {
  try {
    const now = new Date();
    const lahoreStr = now.toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false });
    const h = parseInt(lahoreStr, 10);
    return isNaN(h) ? (now.getUTCHours() + 5) % 24 : h;
  } catch {
    return (new Date().getUTCHours() + 5) % 24;
  }
}

export function greeting(g: VoiceGender, lang: VoiceLang = 'en'): string {
  const name = agentName(g);
  const hour = getLahoreHour();
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  if (lang === 'ur') {
    if (hour >= 5 && hour < 12) {
      return pick([
        `صبح بخیر! برونز کافی ہاؤس میں خوش آمدید، میں ${name} ہوں۔ فرمائیے، آپ کے لیے ٹیبل بک کروں یا ناشتے کا آرڈر لیں؟`,
        `السلام علیکم، صبح بخیر! برونز فرنٹ ڈیسک سے ${name} حاضر ہے۔ آج آپ کی کیا خدمت کر سکتی ہوں؟`,
        `صبح بخیر! برونز میں خوش آمدید، ${name} بات کر رہی ہوں۔ تازہ کافی تیار ہے، بتائیے کیا منگوائیں گے؟`,
      ]);
    }
    if (hour >= 12 && hour < 17) {
      return pick([
        `السلام علیکم! برونز کافی ہاؤس میں خوش آمدید، ${name} بات کر رہی ہوں۔ کیا میں آپ کے لیے ٹیبل بک کروں یا لنچ کا آرڈر لکھوں؟`,
        `دوپہر بخیر! برونز گلبرگ اور ڈی ایچ اے سے ${name}۔ بتائیے آج آپ کے لیے کیا تیار کروائیں؟`,
        `السلام علیکم! برونز سے ${name} حاضر ہے۔ ٹیبل ریزرویشن، ایونٹ بکنگ یا مینو سے آرڈر کے لیے بتائیے۔`,
      ]);
    }
    if (hour >= 17 && hour < 22) {
      return pick([
        `شام بخیر! برونز کافی ہاؤس میں خوش آمدید، ${name} حاضر ہوں۔ کیا آپ گلبرگ یا ڈی ایچ اے میں شام کی ٹیبل بک کرنا چاہیں گے؟`,
        `السلام علیکم! برونز فرنٹ ڈیسک سے ${name}۔ آج رات کے لیے ٹیبل بک کروانی ہے یا کچھ ڈلیور کروائیں؟`,
        `شام بخیر! برونز میں خوش آمدید، میں ${name} ہوں۔ فرمائیے آج آپ کی کیا مدد کروں؟`,
      ]);
    }
    return pick([
      `السلام علیکم! برونز کافی ہاؤس سے ${name} بات کر رہی ہوں۔ ہمارے کاؤنٹرز اب بند ہیں مگر کل کے لیے ٹیبل یا آرڈر بک کر سکتی ہوں۔ فرمائیے؟`,
      `ہیلو! برونز سے ${name}۔ کل کی بکنگ یا آرڈر کے لیے فرمائیے، میں حاضر ہوں۔`,
    ]);
  }

  // English
  if (hour >= 5 && hour < 12) {
    return pick([
      `Good morning! Thanks for calling brewns roastery. This is ${name} at the front desk. Can I get a breakfast table ready or start an order for you?`,
      `Good morning! Brewns coffee house, ${name} speaking. Slow roast beans are freshly brewed — what can I do for you today?`,
      `Hi there, good morning! Thanks for calling brewns. This is ${name}. I can book you a morning table, plan a gathering, or take an order. How can I help?`,
      `Good morning! Welcome to brewns specialty coffee. ${name} here. Looking to book a table at Gulberg or DHA, or can I get your coffee started?`,
    ]);
  }
  if (hour >= 12 && hour < 17) {
    return pick([
      `Good afternoon! Thanks for calling brewns. ${name} here at the concierge. Looking to reserve a table for lunch, or can I get an order started for you?`,
      `Hi there, good afternoon! Brewns coffee house, this is ${name}. What can I help you with today?`,
      `Afternoon! Brewns front desk, ${name} speaking. Whether it's a table booking, a party, or something from the kitchen, I'm here to help!`,
      `Good afternoon! Welcome to brewns. This is ${name}. How are you doing today, and how can I help?`,
    ]);
  }
  if (hour >= 17 && hour < 22) {
    return pick([
      `Good evening! Welcome to brewns. This is ${name} at the front desk. The counters are lively tonight — would you like to book a table at Gulberg, DHA, or Johar Town?`,
      `Good evening! Thanks for calling brewns coffee house. ${name} speaking. Can I reserve a table for you tonight or help with an order?`,
      `Good evening! This is ${name} at brewns. Hope your day went great! Can I get a table ready or help you explore the menu?`,
      `Hi there, good evening! Brewns front desk, ${name} here. Table reservation, party booking, or delivery — what can I do for you?`,
    ]);
  }
  return pick([
    `Hi, thanks for calling brewns! This is ${name}. Our counters are closed for the night, but I can gladly take your booking or order for tomorrow. What can I do for you?`,
    `Hello! Thanks for reaching out to brewns. ${name} here. I can get your table booked for tomorrow or help with party details. What's on your mind?`,
  ]);
}

export async function processVoiceCallPrompt(
  prompt: string,
  history: VoiceTurn[] = [],
  gender: VoiceGender = 'female',
  state: ScriptState = {},
  hint: VoiceLang = 'en',
): Promise<VoiceCallResponse> {
  const special = prompt === 'call_init' || prompt === 'voice_switch';
  const lang: VoiceLang = special ? hint : detectLang(prompt) === 'ur' ? 'ur' : hint === 'ur' && !clearlyEnglish(prompt) ? 'ur' : 'en';
  let brain: VoiceCallResponse['brain'] = 'script';
  let turn: { reply: string; actions: VoiceAction[]; state?: ScriptState };

  if (prompt === 'call_init') {
    turn = { reply: greeting(gender, lang), actions: [] };
  } else if (prompt === 'voice_switch') {
    const sw = lang === 'ur'
      ? [`جی، میں ${agentName(gender)} ہوں۔ اب میں آپ کی کال سنبھالتی ہوں، ہم کہاں تک پہنچے تھے؟`, `السلام علیکم، ${agentName(gender)} حاضر ہے۔ بتائیے میں کیا مدد کروں؟`]
      : [`Hi, ${agentName(gender)} here, I'll take it from here. Where were we?`, `Hey there! ${agentName(gender)} stepping in. How can I help?`, `Hello, ${agentName(gender)} on the line now. What were you thinking?`];
    turn = { reply: sw[Math.floor(Math.random() * sw.length)], actions: [], state };
  } else if (groqEnabled()) {
    try {
      turn = await groqTurn(prompt, history, gender, lang);
      brain = 'groq';
    } catch (err) {
      console.error('[Voice Groq]', err instanceof Error ? err.message : err);
      if (geminiEnabled()) {
        try {
          turn = await geminiTurn(prompt, history, gender, lang);
          brain = 'gemini';
        } catch {
          turn = await scriptTurn(prompt, gender, state, history);
          brain = 'script';
        }
      } else {
        turn = await scriptTurn(prompt, gender, state, history);
        brain = 'script';
      }
    }
  } else if (geminiEnabled()) {
    try {
      turn = await geminiTurn(prompt, history, gender, lang);
      brain = 'gemini';
    } catch (err) {
      console.error('[Voice Gemini]', err instanceof Error ? err.message : err);
      turn = await scriptTurn(prompt, gender, state, history);
      brain = 'script';
    }
  } else {
    turn = await scriptTurn(prompt, gender, state);
  }

  const emailInPrompt = parseEmail(prompt);
  if (emailInPrompt && !turn.actions.some((a) => a.type === 'SAVED_EMAIL')) {
    const codeFromHistory = bookingCodeFromHistory(history);
    const r = await attachEmailToBooking(emailInPrompt, codeFromHistory);
    if (r.ok) {
      turn.actions.push({ type: 'SAVED_EMAIL', data: { email: emailInPrompt, code: r.code, sent: Boolean(r.sent) } });
      turn.reply = r.sent
        ? lang === 'ur' ? `آپ کی کنفرمیشن ای میل ${emailInPrompt} پر بھیج دی ہے۔ کیا میں کسی اور چیز میں مدد کروں؟` : `I've sent the confirmation details to ${emailInPrompt}. Is there anything else I can help with?`
        : lang === 'ur' ? `آپ کا ای میل بکنگ کے ساتھ محفوظ ہو گیا ہے، لیکن کنفرمیشن ای میل نہیں بھیجی جا سکی۔` : `I've saved ${emailInPrompt} to your booking, but the confirmation email could not be delivered.`;
    } else if (/\b(sent|saved|emailed|email is on its way|confirmation sent)\b/i.test(turn.reply) || /بھیج دی|ارسال کر دی/i.test(turn.reply)) {
      turn.reply = 'I have your email, but I need your booking confirmation code to attach it to the right reservation. Could you repeat that code?';
    }
  }

  const audioUrl = ttsEnabled() ? ttsUrl(turn.reply, gender, replyLang(turn.reply)) : undefined;
  return { reply: turn.reply, audioUrl, actions: turn.actions, state: turn.state, brain, lang };
}
