import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { toUrduScript } from '@/lib/devanagari';

export const maxDuration = 15;

/** POST /api/voice/urdu { text }: what a caller said, transcribed in Hindi
    script or Roman Urdu, rewritten in proper Urdu spelling and spacing. The browser has
    already shown a letter-for-letter version; this is the tidy one. */
export const POST = route(async (req) => {
  await rateLimit(`voice-urdu:${clientIp(req)}`, 300, 3600, 'Too many requests.');
  const text = str((await readBody(req)).text, 600);
  if (!text) return json({ text: '' });
  const rough = toUrduScript(text);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ text: rough });
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You convert spoken Hindustani that was transcribed in Devanagari or in Roman Urdu (Urdu written in English letters) into standard Urdu script, exactly as a Pakistani writer in Lahore would write the same words. Keep every word and its meaning; do not translate, answer, add or remove anything. Use correct Urdu spelling and word spacing (آپ کی, not آپکی; ضرور, not زرور). Write English loanwords (table, latte, delivery, branch) in Urdu script as Pakistanis spell them. Keep numbers, names and email addresses as they are. Reply with the Urdu text only.' }],
        },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => ({}));
    const out = String(data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '').trim();
    // Only trust an answer that is actually Urdu and about the same length.
    if (res.ok && /[؀-ۿ]/.test(out) && !/[ऀ-ॿ]/.test(out) && out.length < rough.length * 2 + 20) return json({ text: out });
    if (!res.ok) console.error('[Voice urdu]', res.status, JSON.stringify(data).slice(0, 200));
  } catch (err) {
    console.error('[Voice urdu]', err instanceof Error ? err.message : err);
  }
  return json({ text: rough });
});
