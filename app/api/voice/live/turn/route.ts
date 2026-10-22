import { after } from 'next/server';
import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { agentName } from '@/lib/server/voiceCall';
import { logVoiceTurn, validCallId } from '@/lib/server/voiceLog';

/** POST /api/voice/live/turn: one finished turn of a live call, for the owner's call log.
    Only the words; what got booked is logged by the tool route, which ran it. */
export const POST = route(async (req) => {
  await rateLimit(`voice-turn:${clientIp(req)}`, 400, 3600, 'The line is busy.');
  const b = await readBody(req);
  if (!validCallId(b.callId)) return json({ ok: false }, 400);
  const agent = str(b.agent, 900);
  if (!agent) return json({ ok: true });
  const gender = b.gender === 'male' ? 'male' : 'female';
  const lang = b.lang === 'ur' ? 'ur' : 'en';
  after(() =>
    logVoiceTurn(b.callId as string, { caller: str(b.caller, 600) || undefined, agent, gender, agentName: agentName(gender), lang, brain: 'gemini', actions: [] }).catch((err) =>
      console.error('[Voice log]', err instanceof Error ? err.message : err),
    ),
  );
  return json({ ok: true });
});
