import { CUES } from '@/lib/howItWorks';

export const dynamic = 'force-static';

const stamp = (s: number) => {
  const ms = Math.round(s * 1000);
  const mm = String(Math.floor(ms / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `00:${mm}:${ss}.${String(ms % 1000).padStart(3, '0')}`;
};

/** GET /how-it-works/captions.vtt: the film's English captions, built from its transcript. */
export function GET() {
  const body = ['WEBVTT', '', ...CUES.flatMap(([from, to, text], i) => [String(i + 1), `${stamp(from)} --> ${stamp(to)}`, text, ''])].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
