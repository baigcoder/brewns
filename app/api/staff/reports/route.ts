import { requireStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { RANGES, report, type Range } from '@/lib/server/reports';
import { storeInfo } from '@/lib/server/store';

export const GET = route(async (req) => {
  const ctx = await requireStaff(['reports.view']);
  const r = new URL(req.url).searchParams.get('range') as Range;
  return json({ ...(await report(RANGES.includes(r) ? r : 'today', ctx)), store: storeInfo() });
});
