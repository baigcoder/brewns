import { clientIp, fail, rateLimit, route } from '@/lib/server/http';
import { readTtsToken, streamElevenLabsVoice } from '@/lib/server/voiceCall';

export const maxDuration = 30;

/** GET /api/voice/tts?p=…&s=…: one concierge line, streamed as it is spoken. */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const line = readTtsToken(url.searchParams.get('p') || '', url.searchParams.get('s') || '');
  if (!line) fail(404, 'Nothing to say.');
  await rateLimit(`voice-tts:${clientIp(req)}`, 240, 3600, 'The line is busy.');

  const audio = await streamElevenLabsVoice(line!.text, line!.gender, line!.lang);
  if (!audio) fail(502, 'The voice is unavailable right now.');
  return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } });
});
