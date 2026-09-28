import { clientIp, json, rateLimit, route } from '@/lib/server/http';

export const maxDuration = 30;

/** POST /api/voice/transcribe: transcribe spoken voice audio using Groq Whisper. */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`transcribe:${ip}`, 3000, 3600, 'Audio transcription limit reached. Please try typing.');

  const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return json({ error: 'Audio clip is too large. Please try a shorter message.' }, 413);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: 'Groq API key not configured' }, 500);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return json({ error: 'Missing form data' }, 400);
  }

  const callId = formData.get('callId');
  if (typeof callId === 'string' && /^[a-zA-Z0-9-]{8,48}$/.test(callId)) {
    await rateLimit(`transcribe-call:${callId}`, 120, 3600, 'This call has reached its voice limit. Please start a new call.');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'Missing audio file' }, 400);
  }
  if (file.size === 0) return json({ error: 'The microphone did not capture any audio.' }, 400);
  if (file.size > MAX_AUDIO_BYTES) return json({ error: 'Audio clip is too large. Please try a shorter message.' }, 413);

  const groqForm = new FormData();
  groqForm.append('file', file);
  groqForm.append('model', 'whisper-large-v3-turbo');
  groqForm.append('temperature', '0.0');
  groqForm.append('response_format', 'json');
  const language = formData.get('language');
  if (language === 'en' || language === 'ur') groqForm.append('language', language);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqForm,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Groq Whisper Error]', res.status, errText);
      return json({ error: 'Transcription failed' }, res.status);
    }

    const data = await res.json();
    const text = (data.text || '').trim();
    return json({ success: true, text });
  } catch (err: any) {
    console.error('[Groq Whisper Exception]', err);
    return json({ error: err?.message || 'Transcription exception' }, 500);
  }
});
