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
    Gemini first, in the live line's voice so Sarah sounds the same on both
    lines; then ElevenLabs (the studio voice), then Groq's Orpheus. The X-Voice
    header says which answered, so the call can show it. */
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

  const gemini = await generateGeminiVoice(line.text, line.gender, line.lang);
  if (gemini) return new Response(once(gemini), { headers: headers('audio/wav', 'natural', 'gemini') });

  const eleven = await streamElevenLabsVoice(line.text, line.gender, line.lang);
  if (eleven) return new Response(eleven, { headers: headers('audio/mpeg', 'studio', 'elevenlabs') });

  const groq = await generateGroqVoice(line.text, line.gender, line.lang);
  if (groq) return new Response(once(groq), { headers: headers('audio/wav', 'natural', 'groq') });

  return fail(502, 'The voice is unavailable right now.');
});
