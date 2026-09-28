import { after } from 'next/server';
import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { agentName, processVoiceCallPrompt, type ScriptState, type VoiceTurn } from '@/lib/server/voiceCall';
import { endVoiceCall, logVoiceTurn, validCallId } from '@/lib/server/voiceLog';

export const maxDuration = 30;

/** POST /api/voice/call: one turn of the AI voice call, logged for the owner's dashboard. */
export const POST = route(async (req) => {
  // A call is a few dozen turns; this stops a script from booking the café full.
  const ip = clientIp(req);
  // A venue's Wi-Fi shares one IP across callers, so keep its aggregate ceiling
  // high and apply the conversational quota to each independent call as well.
  await rateLimit(`voice:${ip}`, 3000, 3600, 'The line is busy. Please try again in a little while.');

  const b = await readBody(req);
  const callId = validCallId(b.callId) ? b.callId : '';
  if (callId) await rateLimit(`voice-call:${callId}`, 120, 3600, 'This call has reached its voice limit. Please start a new call.');
  const prompt = str(b.prompt ?? b.message, 600);

  // The caller hung up.
  if (prompt === 'call_end') {
    if (callId) await endVoiceCall(callId);
    return json({ success: true });
  }

  const gender = b.gender === 'male' ? 'male' : 'female';
  const rawHistory = Array.isArray(b.history) ? b.history : Array.isArray(b.conversationHistory) ? b.conversationHistory : [];
  const history: VoiceTurn[] = rawHistory
    .slice(-24)
    .map((t: { role?: unknown; content?: unknown }) => ({ role: t?.role === 'assistant' ? 'assistant' : 'user', content: str(t?.content, 800) }) as VoiceTurn)
    .filter((t: VoiceTurn) => t.content);
  const state = b.state && typeof b.state === 'object' ? (b.state as ScriptState) : {};
  const lang = b.lang === 'ur' ? 'ur' : 'en';

  const message = prompt || 'call_init';
  const result = await processVoiceCallPrompt(message, history, gender, state, lang);

  if (callId) {
    const caller = message === 'call_init' || message === 'language_switch' ? undefined : message === 'voice_switch' ? `(switched to ${agentName(gender)})` : message;
    // Dashboard logging should not hold the caller's spoken reply behind storage.
    after(() => logVoiceTurn(callId, { caller, agent: result.reply, gender, agentName: agentName(gender), lang: result.lang, brain: result.brain, actions: result.actions }).catch((err) =>
      console.error('[Voice log]', err instanceof Error ? err.message : err),
    ));
  }
  return json({ success: true, ...result });
});
