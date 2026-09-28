import { clientIp, fail, rateLimit, route } from '@/lib/server/http';
import { generateGeminiVoice, readTtsToken, streamElevenLabsVoice } from '@/lib/server/voiceCall';

export const maxDuration = 30;

/** GET /api/voice/tts?p=…&s=…: one concierge line, streamed as it is spoken. */
export const GET = route(async (req): Promise<Response> => {
  const url = new URL(req.url);
  const line = readTtsToken(url.searchParams.get('p') || '', url.searchParams.get('s') || '');
  if (!line) return fail(404, 'Nothing to say.');
  await rateLimit(`voice-tts:${clientIp(req)}`, 3000, 3600, 'The line is busy.');

  // Prefer Gemini for Urdu: the built-in ElevenLabs Sarah/George defaults are
  // English voices, and some reject or anglicize Urdu even with v3 selected.
  const providers = line.lang === 'ur'
    ? [
        async () => {
          const audio = await generateGeminiVoice(line.text, line.gender, line.lang);
          return audio ? new Response(new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(audio); controller.close(); },
          }), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store' } }) : null;
        },
        async () => {
          const audio = await streamElevenLabsVoice(line.text, line.gender, line.lang);
          return audio ? new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } }) : null;
        },
      ]
    : [
        async () => {
          const audio = await streamElevenLabsVoice(line.text, line.gender, line.lang);
          return audio ? new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } }) : null;
        },
        async () => {
          const audio = await generateGeminiVoice(line.text, line.gender, line.lang);
          return audio ? new Response(new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(audio); controller.close(); },
          }), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store' } }) : null;
        },
      ];
  for (const generate of providers) {
    const response = await generate();
    if (response) return response;
  }
  return fail(502, 'The voice is unavailable right now.');
});
