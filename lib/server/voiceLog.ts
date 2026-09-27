/* Every AI voice call, as it happens: who the caller spoke to, in which
   language, what was said, and what the call booked or ordered. The owner and
   managers watch it live on Bookings & AI calls. Kept for 30 days. */

import { kv } from './store';
import { bumpLive } from './orders';
import type { VoiceAction, VoiceGender, VoiceLang } from './voiceCall';

export type VoiceOutcome = { kind: 'table' | 'party' | 'bag'; code?: string; summary: string; total?: number };

export interface VoiceCallLog {
  id: string;
  startedAt: number;
  lastAt: number;
  endedAt?: number;
  agent: string;
  langs: VoiceLang[];
  brain: 'gemini' | 'script';
  turns: { who: 'caller' | 'agent'; text: string; t: number }[];
  outcomes: VoiceOutcome[];
}

const KEY = 'voice_calls';
const KEEP_MS = 30 * 86_400_000;
const MAX_TURNS = 80;
/** A call nobody has spoken on for this long is treated as over (tab closed, signal lost). */
export const LIVE_WINDOW_MS = 90_000;

export const validCallId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{8,48}$/.test(id);
export const isLive = (c: VoiceCallLog, now = Date.now()) => !c.endedAt && now - c.lastAt < LIVE_WINDOW_MS;

function outcomesOf(actions: VoiceAction[]): VoiceOutcome[] {
  return actions.flatMap((a): VoiceOutcome[] => {
    if (a.type === 'RESERVE_TABLE') return [{ kind: 'table', code: a.data.code, summary: `Table for ${a.data.guests} · ${a.data.date} ${a.data.time} · ${a.data.name}` }];
    if (a.type === 'BOOK_PARTY') return [{ kind: 'party', code: a.data.code, summary: `${a.data.type} for ${a.data.guests} · ${a.data.date} ${a.data.time} · ${a.data.name}` }];
    if (a.type === 'ADD_TO_BAG') return [{ kind: 'bag', summary: a.data.items.map((l) => `${l.qty} × ${l.name}`).join(', '), total: a.data.total }];
    return [];
  });
}

/** Record one turn of a call (creating the call on its first turn). */
export async function logVoiceTurn(
  id: string,
  t: { caller?: string; agent: string; gender: VoiceGender; agentName: string; lang: VoiceLang; brain: 'gemini' | 'script'; actions: VoiceAction[] },
) {
  const now = Date.now();
  const call: VoiceCallLog = (await kv.hget<VoiceCallLog>(KEY, id)) || { id, startedAt: now, lastAt: now, agent: t.agentName, langs: [], brain: t.brain, turns: [], outcomes: [] };
  if (call.endedAt) return;
  if (t.caller) call.turns.push({ who: 'caller', text: t.caller.slice(0, 600), t: now });
  call.turns.push({ who: 'agent', text: t.agent.slice(0, 900), t: now });
  call.turns = call.turns.slice(-MAX_TURNS);
  if (!call.langs.includes(t.lang)) call.langs.push(t.lang);
  call.agent = t.agentName;
  call.brain = t.brain;
  call.outcomes.push(...outcomesOf(t.actions));
  if (t.actions.some((a) => a.type === 'END_CALL')) call.endedAt = now;
  call.lastAt = now;
  await kv.hset(KEY, id, call);
  await bumpLive();
}

export async function endVoiceCall(id: string) {
  const call = await kv.hget<VoiceCallLog>(KEY, id);
  if (!call || call.endedAt) return;
  call.endedAt = Date.now();
  await kv.hset(KEY, id, call);
  await bumpLive();
}

/** Calls from the last 30 days, newest first; older ones are dropped as they're found. */
export async function recentVoiceCalls(): Promise<VoiceCallLog[]> {
  const all = Object.values((await kv.hall<VoiceCallLog>(KEY)) || {});
  const cutoff = Date.now() - KEEP_MS;
  const stale = all.filter((c) => c.lastAt < cutoff).map((c) => c.id);
  if (stale.length) await kv.hdel(KEY, ...stale);
  return all.filter((c) => c.lastAt >= cutoff).sort((a, b) => b.lastAt - a.lastAt);
}
