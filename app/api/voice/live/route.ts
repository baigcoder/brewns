import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { createLiveToken, liveSetup } from '@/lib/server/voiceCall';
import { asCaller, readCaller } from '@/lib/server/voiceContext';
import { validCallId } from '@/lib/server/voiceLog';

export const maxDuration = 15;

const WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

/** POST /api/voice/live: a one-use Gemini Live token for one call, or
    { live: false } so the browser falls back to the step-by-step voice. */
export const POST = route(async (req) => {
  await rateLimit(`voice-live:${clientIp(req)}`, 60, 3600, 'The line is busy. Please try again in a little while.');
  const b = await readBody(req);
  if (!validCallId(b.callId)) return json({ live: false });
  const gender = b.gender === 'male' ? 'male' : 'female';
  const lang = b.lang === 'ur' ? 'ur' : 'en';
  // The briefing names a signed-in regular and today's sold-out items.
  const setup = await asCaller(await readCaller(), async () => liveSetup(gender, lang, str(b.recap, 3000)));
  const token = await createLiveToken(setup);
  if (!token) return json({ live: false });
  return json({ live: true, url: `${WS}?access_token=${encodeURIComponent(token)}`, setup });
});
