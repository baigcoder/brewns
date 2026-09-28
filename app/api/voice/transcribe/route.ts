import { clientIp, json, rateLimit, route } from '@/lib/server/http';

export const maxDuration = 30;

/** POST /api/voice/transcribe: transcribe spoken voice audio using Groq Whisper. */
export const POST = route(async (req) => {
  await rateLimit(`transcribe:${clientIp(req)}`, 120, 3600, 'Audio transcription limit reached. Please try typing.');

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: 'Groq API key not configured' }, 500);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return json({ error: 'Missing form data' }, 400);
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'Missing audio file' }, 400);
  }

  const groqForm = new FormData();
  groqForm.append('file', file);
  groqForm.append('model', 'whisper-large-v3-turbo');
  groqForm.append('temperature', '0.0');
  groqForm.append('response_format', 'json');

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
