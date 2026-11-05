import { after } from 'next/server';
import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { agentName, runLiveTool } from '@/lib/server/voiceCall';
import { asCaller, readCaller } from '@/lib/server/voiceContext';
import { logVoiceTurn, validCallId } from '@/lib/server/voiceLog';

export const maxDuration = 30;

const TOOLS = new Set(['reserve_table', 'book_party', 'save_booking_email', 'add_to_bag', 'place_order', 'check_order', 'check_table', 'request_callback', 'end_call']);

/** POST /api/voice/live/tool: run a tool the Live model called mid-call. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  // Sent as the call connects: wakes this function (and its code) so the first real tool call isn't a cold start.
  if (b.warm === true) return json({ ok: true });
  if (!validCallId(b.callId)) return json({ error: 'No call.' }, 400);
  const name = str(b.name, 40);
  if (!TOOLS.has(name)) return json({ output: { error: `Unknown tool ${name}` }, actions: [] });
  // The checks and who's calling, all at once: each is a round trip to the store.
  const [, , caller] = await Promise.all([
    rateLimit(`voice-tool:${clientIp(req)}`, 200, 3600, 'The line is busy.'),
    rateLimit(`voice-tool-call:${b.callId}`, 40, 3600, 'This call has reached its limit.'),
    readCaller(),
  ]);
  const args = b.args && typeof b.args === 'object' && !Array.isArray(b.args) ? (b.args as Record<string, unknown>) : {};
  const result = await asCaller(caller, () => runLiveTool(name, args, str(b.transcript, 800), str(b.previousAssistant, 900)));
  const done = result.actions.filter((a) => a.type !== 'END_CALL');
  if (done.length) {
    const gender = b.gender === 'male' ? 'male' : 'female';
    after(() =>
      logVoiceTurn(b.callId as string, { agent: `(${name.replace(/_/g, ' ')})`, gender, agentName: agentName(gender), lang: b.lang === 'ur' ? 'ur' : 'en', brain: 'gemini', actions: done }).catch((err) =>
        console.error('[Voice log]', err instanceof Error ? err.message : err),
      ),
    );
  }
  return json(result);
});
