import { requireStaff } from '@/lib/server/auth';
import { funnelDays, funnelSteps } from '@/lib/server/events';
import { json, route } from '@/lib/server/http';

/** The site funnel for the Overview: visits through to orders, over the last 7 or 30 days. */
export const GET = route(async (req) => {
  await requireStaff(['reports.view']);
  const n = Number(new URL(req.url).searchParams.get('days'));
  const days = n === 30 ? 30 : 7;
  const rows = await funnelDays(days);
  return json({ days, byDay: rows, steps: funnelSteps(rows) });
});
