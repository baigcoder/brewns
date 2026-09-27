import { NextRequest, NextResponse } from 'next/server';
import { processVoiceCallPrompt } from '@/lib/server/voiceCall';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt || body.message || '';
    const history = body.history || [];
    const gender = body.gender === 'male' ? 'male' : 'female';

    const result = await processVoiceCallPrompt(prompt, history, gender);

    return NextResponse.json({
      success: true,
      reply: result.reply,
      audioBase64: result.audioBase64,
      action: result.action,
      partyBookingCode: result.partyBookingCode,
      reservationCode: result.reservationCode,
    });
  } catch (err: any) {
    console.error('[Voice Call API Error]', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Voice call service encountered an error',
    }, { status: 500 });
  }
}
