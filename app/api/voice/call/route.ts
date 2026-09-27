import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { processVoiceCallPrompt, type ScriptState, type VoiceTurn } from '@/lib/server/voiceCall';

export const maxDuration = 30;

/** POST /api/voice/call: one turn of the AI voice call. */
export const POST = route(async (req) => {
  // A call is a few dozen turns; this stops a script from booking the café full.
  await rateLimit(`voice:${clientIp(req)}`, 120, 3600, 'The line is busy. Please try again in a little while.');

  const b = await readBody(req);
  const prompt = str(b.prompt ?? b.message, 600);
  const gender = b.gender === 'male' ? 'male' : 'female';
  const rawHistory = Array.isArray(b.history) ? b.history : Array.isArray(b.conversationHistory) ? b.conversationHistory : [];
  const history: VoiceTurn[] = rawHistory
    .slice(-24)
    .map((t: { role?: unknown; content?: unknown }) => ({ role: t?.role === 'assistant' ? 'assistant' : 'user', content: str(t?.content, 800) }) as VoiceTurn)
    .filter((t: VoiceTurn) => t.content);
  const state = b.state && typeof b.state === 'object' ? (b.state as ScriptState) : {};

  const result = await processVoiceCallPrompt(prompt || 'call_init', history, gender, state);
  return json({ success: true, ...result });
});
