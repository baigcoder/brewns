import { clientIp, fail, rateLimit, route } from '@/lib/server/http';
import { generateGeminiVoice, generateGroqVoice, readTtsToken, streamElevenLabsVoice } from '@/lib/server/voiceCall';

export const maxDuration = 30;

const once = (audio: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(audio);
      controller.close();
    },
  });

/** GET /api/voice/tts?p=…&s=…: one concierge line, streamed as it is spoken.
    English: ElevenLabs first (the studio voice, a whole line in about 0.9 s),
    then Gemini, which matches the live line's voice but takes 4–5 s a line and
    left callers in silence; then Groq's Orpheus. Urdu: Gemini first, which
    speaks it best. The X-Voice header says which answered, so the call can show it. */
export const GET = route(async (req): Promise<Response> => {
  const url = new URL(req.url);
  const line = readTtsToken(url.searchParams.get('p') || '', url.searchParams.get('s') || '');
  if (!line) return fail(404, 'Nothing to say.');
  await rateLimit(`voice-tts:${clientIp(req)}`, 600, 3600, 'The line is busy.');

  const headers = (type: string, voice: string, provider: string) => ({
    'Content-Type': type,
    'Cache-Control': 'private, no-store',
    'X-Voice': voice,
    'X-Voice-Provider': provider,
    'Access-Control-Expose-Headers': 'X-Voice, X-Voice-Provider',
  });

  const eleven = () => streamElevenLabsVoice(line.text, line.gender, line.lang);
  const gemini = () => generateGeminiVoice(line.text, line.gender, line.lang);
  const first = line.lang === 'en' ? await eleven() : null;
  if (first) return new Response(first, { headers: headers('audio/mpeg', 'studio', 'elevenlabs') });

  const natural = await gemini();
  if (natural) return new Response(once(natural), { headers: headers('audio/wav', 'natural', 'gemini') });

  const studio = line.lang === 'en' ? null : await eleven();
  if (studio) return new Response(studio, { headers: headers('audio/mpeg', 'studio', 'elevenlabs') });

  const groq = await generateGroqVoice(line.text, line.gender, line.lang);
  if (groq) return new Response(once(groq), { headers: headers('audio/wav', 'natural', 'groq') });

  return fail(502, 'The voice is unavailable right now.');
});
