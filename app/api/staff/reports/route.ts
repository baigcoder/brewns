import { requireStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { RANGES, report, reportCsv, type Range } from '@/lib/server/reports';
import { storeInfo } from '@/lib/server/store';

export const GET = route(async (req) => {
  const ctx = await requireStaff(['reports.view']);
  const q = new URL(req.url).searchParams;
  const r = q.get('range') as Range;
  const range = RANGES.includes(r) ? r : 'today';
  const data = await report(range, ctx);
  if (q.get('format') === 'csv')
    return new Response(reportCsv(data), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="brewns-${range}.csv"`, 'Cache-Control': 'no-store' },
    });
  return json({ ...data, store: storeInfo() });
});
