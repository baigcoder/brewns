/* The voice concierge: what Sarah / George hear, think and say.

   Two brains behind one call:
   - Claude, when ANTHROPIC_API_KEY is set. A real conversation: it listens,
     asks one thing at a time, reads the booking back before it commits, and
     books through tools that write to the same store as the website forms.
   - A small slot-filling script otherwise, so the call still works on a laptop
     with no keys. It asks for the same details, one at a time, and keeps its
     place in `state`, which the browser sends back with the next turn.

   The voice is ElevenLabs when ELEVENLABS_API_KEY is set; without it the reply
   comes back as text and the browser speaks it with its own voice. */

import Anthropic from '@anthropic-ai/sdk';
import { randomBytes } from 'node:crypto';
import { kv, withLock } from './store';
import { CATALOG, CLOSE_MIN, LOC_TITLES, OPEN_MIN, SHOP_COUNT, catalogItem, defaultSel, money, pkMobile, unitPrice, validSel, type Product, type Sel } from '@/lib/catalog';
import type { Reservation } from '@/app/api/reservations/route';

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
  | { type: 'END_CALL' };

export interface PartyBooking {
  id: string;
  code: string;
  type: string;
  name: string;
  phone: string;
  location: string;
  loc: number;
  date: string;
  time: string;
  guests: number;
  status: 'confirmed';
  notes: string;
  source: 'voice';
  createdAt: number;
}

/** Where the fallback script is in a booking; the browser echoes it back. */
export interface ScriptState {
  flow?: 'table' | 'party';
  slots?: Partial<Record<'name' | 'phone' | 'loc' | 'date' | 'time' | 'guests' | 'area' | 'occasion', string>>;
  confirming?: boolean;
}

export interface VoiceCallResponse {
  reply: string;
  audioBase64?: string;
  actions: VoiceAction[];
  state?: ScriptState;
  brain: 'claude' | 'script';
}

export const agentName = (g: VoiceGender) => (g === 'male' ? 'George' : 'Sarah');

/* ═══════════ voice ═══════════ */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE_IDS: Record<VoiceGender, string> = {
  female: process.env.ELEVENLABS_VOICE_ID_FEMALE || 'EXAVITQu4vr4xnSDxMaL', // Sarah
  male: process.env.ELEVENLABS_VOICE_ID_MALE || 'JBFqnCBsd6RMkjVDRZzb', // George
};

/** Speak `text` with ElevenLabs. Conversational settings: a little less stable
    and a little more style than narration, so it sounds like someone talking,
    not reading. Null when there is no key or the call fails; the browser then
    uses its own voice. */
export async function synthesizeElevenLabsVoice(text: string, gender: VoiceGender): Promise<string | null> {
  if (!ELEVENLABS_API_KEY || !text) return null;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[gender]}?output_format=mp3_44100_128&optimize_streaming_latency=3`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
        voice_settings: { stability: 0.38, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.02 },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error('[ElevenLabs TTS]', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return `data:audio/mpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
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
  if (/\bmorning\b/.test(t)) return 10 * 60;
  if (/\b(lunch|afternoon)\b/.test(t)) return 14 * 60;
  if (/\b(evening|dinner|tonight)\b/.test(t)) return 19 * 60;
  return -1;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
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
const withArticle = (t: string) => `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${t}`;

export function parseShop(text: string): number {
  const t = text.toLowerCase();
  if (/\b(dha|defence|defense|cca|phase 5)\b/.test(t)) return 1;
  if (/\b(johar|wapda|main boulevard)\b/.test(t)) return 2;
  if (/\b(gulberg|mm alam|m\.m\.|alam road|mma)\b/.test(t)) return 0;
  return -1;
}

/* ═══════════ bookings: the checks and the writes ═══════════ */

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

interface BookingInput {
  name?: unknown;
  phone?: unknown;
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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s(b.date)) ? s(b.date) : parseDate(s(b.date));
  const tMin = /^\d{2}:\d{2}$/.test(s(b.time)) ? Number(s(b.time).slice(0, 2)) * 60 + Number(s(b.time).slice(3)) : parseTime(s(b.time));
  const guests = Math.round(Number(b.guests));
  const now = lahoreNow();
  const [minGuests, maxGuests] = kind === 'table' ? [1, 20] : [8, 120];

  if (name.length < 2) return { ok: false, error: 'Need the guest name.' };
  if (!phone) return { ok: false, error: 'Need a valid Pakistani mobile number (03XX XXXXXXX).' };
  if (!Number.isInteger(loc) || loc < 0 || loc >= SHOP_COUNT) return { ok: false, error: 'Need which counter: 0 MM Alam Road, 1 DHA Phase 5, 2 Johar Town.' };
  if (!date) return { ok: false, error: 'Need a date (YYYY-MM-DD).' };
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
  const item = await withLock('reservations', async () => {
    const r: Reservation = {
      id: `res_${Date.now()}_${randomBytes(3).toString('hex')}`,
      code: makeCode('RES'),
      ...c.value,
      email: '',
      area,
      notes: [s(b.notes, 200), 'Booked on the AI voice call.'].filter(Boolean).join(' · ').slice(0, 250) || transcript.slice(0, 250),
      status: 'confirmed',
      createdAt: Date.now(),
    };
    await kv.hset('reservations', r.id, r);
    return r;
  });
  return { ok: true, value: item };
}

async function saveParty(b: BookingInput): Promise<Check<PartyBooking>> {
  const c = checkBooking(b, 'party');
  if (!c.ok) return c;
  const occasion = s(b.occasion, 40) || 'Private party';
  const item = await withLock('party_bookings', async () => {
    const p: PartyBooking = {
      id: randomBytes(6).toString('hex'),
      code: makeCode('PTY'),
      type: occasion.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      ...c.value,
      location: LOC_TITLES[c.value.loc],
      status: 'confirmed',
      notes: [s(b.notes, 200), 'Booked on the AI voice call; the events team calls back to plan the menu.'].filter(Boolean).join(' · '),
      source: 'voice',
      createdAt: Date.now(),
    };
    await kv.hset('party_bookings', p.id, p);
    return p;
  });
  return { ok: true, value: item };
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

/* ═══════════ Claude ═══════════ */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

const MENU_TEXT = CATALOG.filter((p) => !p.gift)
  .map((p) => {
    const opts = p.options
      .filter((o) => o.key !== 'plan')
      .map((o) => `${o.key}: ${o.choices.map(([l, d]) => (d ? `${l.toLowerCase()} +${d}` : l.toLowerCase())).join(' / ')}`)
      .join('; ');
    return `- ${p.id} | ${p.name} | Rs ${p.price}${opts ? ` | ${opts}` : ''}`;
  })
  .join('\n');

const persona = (g: VoiceGender) => `You are ${agentName(g)}, answering the phone at brewns, a specialty coffee house in Lahore. You are on a live voice call: everything you write is spoken aloud by a text-to-speech voice, and the caller's words reach you through speech recognition.

How to sound like a real person on the phone:
- Keep each turn short: one to three sentences, usually under 35 words. Ask one question at a time and then stop talking.
- Talk, don't write. Contractions, warm and relaxed, the odd "sure", "lovely", "okay, got it". No lists, bullet points, headings, emoji, markdown, or URLs.
- Say prices as "fourteen fifty rupees" or "Rs 1,450", times as "8 PM", dates as "this Friday" or "the 12th of October".
- Speech recognition makes mistakes. If something sounds garbled or a number seems off, check it naturally ("sorry, was that four people or fourteen?") instead of guessing.
- Mirror the caller: if they speak Roman Urdu or mix Urdu and English, answer the same way (e.g. "Ji bilkul, kitne log honge?"). Greet with "Assalam-o-Alaikum" only when they do.
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
- After a booking succeeds, give the confirmation code slowly (the tool result has a spoken form) and ask if there's anything else.
- If a tool returns an error, explain it simply and ask for what's needed. Never invent a code or say something is booked unless the tool succeeded.
- Never invent menu items or prices; use only the menu below, and pass the exact ids to add_to_bag. Mention the price total after adding.
- When the caller says goodbye or is clearly done, say a short friendly goodbye and call end_call.

brewns facts:
- Counters (shop number for tools): 0 = MM Alam Road, Gulberg III (flagship); 1 = CCA, DHA Phase 5; 2 = Main Boulevard, Johar Town. All open every day, 7 AM to 9 PM.
- Delivery across Gulberg, Model Town, Garden Town, DHA Phase 1 to 8, Johar Town and WAPDA Town. Fee Rs 150 to 300, free over Rs 3,000, minimum order Rs 1,000, about 30 to 45 minutes.
- Tax: 16% on cash, 5% on card or JazzCash / Easypaisa.
- House coffee is Slow Roast, Colombian and Ethiopian beans, roasted weekly. Every shot 92°C for 27 seconds.
- brewns Club: a stamp for every drink (two before 9 AM), a free drink every ten, and a birthday drink.
- Founder: Hassan Baig, a software engineer from Lahore. Brand ambassador: Hania Aamir; her order is the iced matcha latte and a cinnamon roll.

Menu (id | name | price | options):
${MENU_TEXT}`;

const bookingProps = {
  name: { type: 'string', description: "Guest's name" },
  phone: { type: 'string', description: 'Pakistani mobile number, e.g. 03001234567' },
  shop: { type: 'integer', enum: [0, 1, 2], description: '0 MM Alam Road, 1 DHA Phase 5, 2 Johar Town' },
  date: { type: 'string', description: 'YYYY-MM-DD, resolved from today in Lahore' },
  time: { type: 'string', description: 'HH:MM, 24-hour' },
  guests: { type: 'integer' },
  notes: { type: 'string', description: 'Anything else the caller asked for (high chair, cake, window seat); empty if none' },
} as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'reserve_table',
    description: 'Book a table after the caller has confirmed all the details you read back. Returns the confirmation code, or an error explaining what to fix.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ...bookingProps, area: { type: 'string', enum: ['indoor', 'terrace', 'bar'] } },
      required: ['name', 'phone', 'shop', 'date', 'time', 'guests', 'area', 'notes'],
      additionalProperties: false,
    },
  },
  {
    name: 'book_party',
    description: 'Book a party or event (8 to 120 guests) after the caller has confirmed the details you read back. Returns the booking code, or an error.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ...bookingProps, occasion: { type: 'string', description: 'e.g. Birthday party, Corporate gathering, Private evening' } },
      required: ['name', 'phone', 'shop', 'date', 'time', 'guests', 'occasion', 'notes'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_to_bag',
    description: "Add menu items to the caller's website bag. Use exact ids from the menu. options maps an option key to the choice label the caller asked for (e.g. {\"milk\": \"oat\", \"size\": \"12\\\"\"}); leave it empty for defaults.",
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              qty: { type: 'integer' },
              options: { type: 'object', additionalProperties: { type: 'string' } },
            },
            required: ['id', 'qty'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'end_call',
    description: 'Hang up after you have said goodbye.',
    input_schema: { type: 'object', properties: {} },
  },
];

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 }));

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** Tidy anything that would sound wrong read aloud. */
const speakable = (t: string) =>
  t
    .replace(/[*_#`>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();

async function runTool(name: string, input: Record<string, unknown>, transcript: string, actions: VoiceAction[]): Promise<{ content: string; isError?: boolean }> {
  if (name === 'reserve_table') {
    const r = await saveReservation(input, transcript);
    if (!r.ok) return { content: r.error, isError: true };
    actions.push({ type: 'RESERVE_TABLE', data: r.value });
    return { content: JSON.stringify({ booked: true, code: r.value.code, say_code_as: spokenCode(r.value.code), counter: LOC_TITLES[r.value.loc], date: spokenDate(r.value.date), time: spokenTime(r.value.time), guests: r.value.guests }) };
  }
  if (name === 'book_party') {
    const r = await saveParty(input);
    if (!r.ok) return { content: r.error, isError: true };
    actions.push({ type: 'BOOK_PARTY', data: r.value });
    return { content: JSON.stringify({ booked: true, code: r.value.code, say_code_as: spokenCode(r.value.code), counter: r.value.location, date: spokenDate(r.value.date), time: spokenTime(r.value.time), guests: r.value.guests }) };
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

async function claudeTurn(prompt: string, history: VoiceTurn[], gender: VoiceGender): Promise<{ reply: string; actions: VoiceAction[] }> {
  const now = lahoreNow();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  // The API wants turns to start with the caller; the greeting is folded in as context.
  for (const t of history) {
    if (!messages.length && t.role === 'assistant') messages.push({ role: 'user', content: '(call connected)' });
    messages.push({ role: t.role, content: t.content });
  }
  messages.push({ role: 'user', content: prompt });

  const actions: VoiceAction[] = [];
  const spoken: string[] = [];

  for (let hop = 0; hop < 4; hop++) {
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: persona(gender), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Right now in Lahore it is ${now.weekday} ${now.date}, ${now.clock}.` },
      ],
      tools: TOOLS,
      messages,
    });

    if (res.stop_reason === 'refusal') {
      return { reply: "Sorry, I can't help with that one. Is there anything about a table, a party or your order I can do for you?", actions };
    }

    for (const b of res.content) if (b.type === 'text' && b.text.trim()) spoken.push(b.text);
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) break;

    messages.push({ role: 'assistant', content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = await runTool(u.name, (u.input || {}) as Record<string, unknown>, prompt, actions);
      results.push({ type: 'tool_result', tool_use_id: u.id, content: out.content, is_error: out.isError });
    }
    messages.push({ role: 'user', content: results });
    // Hanging up needs no further words once the goodbye is said.
    if (uses.every((u) => u.name === 'end_call') && spoken.length) break;
  }

  const reply = speakable(spoken.join(' ')) || (actions.some((a) => a.type === 'END_CALL') ? 'Thanks for calling brewns. Take care!' : 'Sorry, could you say that again?');
  return { reply, actions };
}

/* ═══════════ the script, when there is no Claude key ═══════════ */

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
  if (t >= 0 && (asked === 'time' || /\d\s*(am|pm|a\.m|p\.m)|\d:\d\d|\b(at|around|by|about)\s+\d|morning|afternoon|evening|lunch|dinner|tonight/.test(p))) sl.time = hhmm(t);
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
  const flow = st.flow!;
  const actions: VoiceAction[] = [];

  if (st.confirming) {
    if (/\b(yes|yeah|yep|sure|confirm|correct|right|ok|okay|go ahead|book it|haan|ji|theek)\b/.test(p)) {
      const sl = st.slots || {};
      const input = { name: sl.name, phone: sl.phone, shop: Number(sl.loc), date: sl.date, time: sl.time, guests: Number(sl.guests), area: sl.area, occasion: sl.occasion, notes: '' };
      const r = flow === 'party' ? await saveParty(input) : await saveReservation(input, raw);
      if (!r.ok) return { reply: `Hmm, I couldn't book that: ${r.error} Could you give me a different one?`, actions, state: { flow, slots: sl } };
      actions.push(flow === 'party' ? { type: 'BOOK_PARTY', data: r.value as PartyBooking } : { type: 'RESERVE_TABLE', data: r.value as Reservation });
      const code = r.value.code;
      const reply =
        flow === 'party'
          ? `You're all booked! Your code is ${spokenCode(code)}. Our events team will call you to plan the food and setup. Anything else I can help with?`
          : `Done, your table's confirmed! Your code is ${spokenCode(code)}. See you then. Anything else?`;
      return { reply, actions, state: {} };
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

async function scriptTurn(prompt: string, gender: VoiceGender, state: ScriptState): Promise<{ reply: string; actions: VoiceAction[]; state: ScriptState }> {
  const raw = prompt.trim();
  const p = raw.toLowerCase();
  const name = agentName(gender);

  if (state.flow) {
    if (/\b(cancel|never ?mind|forget it|stop|start over)\b/.test(p)) return { reply: 'No worries, I\'ve dropped that. What else can I do for you?', actions: [], state: {} };
    return scriptBooking(p, raw, state);
  }

  if (/\b(bye|goodbye|that's all|thats all|nothing else|no thanks|khuda hafiz|allah hafiz)\b/.test(p))
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
  if (found.size) {
    const r = checkBag([...found].map(([id, qty]) => ({ id, qty })));
    if (r.ok) {
      const said = r.value.items.map((l) => (l.qty > 1 ? `${l.qty} ${titleCase(l.name)}s` : withArticle(titleCase(l.name)))).join(' and ');
      return {
        reply: `Sure! I've put ${said} in your bag, that's ${money(r.value.total)}. You can choose pickup or delivery at checkout. Anything else?`,
        actions: [{ type: 'ADD_TO_BAG', data: r.value }],
        state: {},
      };
    }
  }
  if (/order|deliver|hungry|menu|eat|drink|coffee/.test(p))
    return { reply: 'Happy to! We have smash burgers, wood-fired pizza, pasta, paratha rolls, coffee and pastries. What are you in the mood for?', actions: [], state: {} };
  if (/hour|open|close|timing|time/.test(p))
    return { reply: "All three counters are open every day from 7 in the morning to 9 at night. Would you like to book a table?", actions: [], state: {} };
  if (/where|location|address|branch|counter/.test(p))
    return { reply: "We're on MM Alam Road in Gulberg, in CCA DHA Phase 5, and on Main Boulevard in Johar Town. Which one's closest to you?", actions: [], state: {} };
  if (/hassan|founder|owner|story/.test(p))
    return { reply: 'brewns was started by Hassan Baig, a software engineer from Lahore who wanted great coffee without the queue. He even built this website himself!', actions: [], state: {} };
  if (/hania|ambassador/.test(p))
    return { reply: "Hania Aamir is our brand ambassador! Her usual is an iced matcha latte with a cinnamon roll. Want me to add that for you?", actions: [], state: {} };
  if (/\b(hi|hello|hey|salam|assalam)\b/.test(p) || !p)
    return { reply: `${/salam|assalam/.test(p) ? 'Wa alaikum assalam!' : 'Hi there!'} This is ${name} at brewns. How can I help?`, actions: [], state: {} };
  return { reply: "I can book you a table, set up a party, or put an order in your bag. Which would you like?", actions: [], state: {} };
}

/* ═══════════ one turn of the call ═══════════ */

export const greeting = (g: VoiceGender) => `Hi, thanks for calling brewns! This is ${agentName(g)}. I can book you a table, plan a party, or get an order started. What can I do for you?`;

export async function processVoiceCallPrompt(
  prompt: string,
  history: VoiceTurn[] = [],
  gender: VoiceGender = 'female',
  state: ScriptState = {},
): Promise<VoiceCallResponse> {
  const brain = claudeEnabled() ? 'claude' : 'script';
  let turn: { reply: string; actions: VoiceAction[]; state?: ScriptState };

  if (prompt === 'call_init') {
    turn = { reply: greeting(gender), actions: [] };
  } else if (prompt === 'voice_switch') {
    turn = { reply: `Hi, ${agentName(gender)} here, I'll take it from here. Where were we?`, actions: [], state };
  } else if (brain === 'claude') {
    try {
      turn = await claudeTurn(prompt, history, gender);
    } catch (err) {
      // Keep the call alive on a bad network moment; the script can carry on.
      console.error('[Voice Claude]', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
      turn = await scriptTurn(prompt, gender, state);
    }
  } else {
    turn = await scriptTurn(prompt, gender, state);
  }

  const audioBase64 = (await synthesizeElevenLabsVoice(turn.reply, gender)) || undefined;
  return { reply: turn.reply, audioBase64, actions: turn.actions, state: turn.state, brain };
}
