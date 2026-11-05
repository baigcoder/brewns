import { isMonth, monthOf } from '@/lib/payroll';
import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { myPay, payAct, payrollFor } from '@/lib/server/payroll';

/** Owners: everyone's pay for `?month=` (default this month). Everyone: their own pay (`?mine=1`). */
export const GET = route(async (req) => {
  const ctx = await requireStaff();
  const url = new URL(req.url);
  if (url.searchParams.get('mine') || ctx.role !== 'owner') return json({ mine: await myPay(ctx.user) });
  const m = url.searchParams.get('month');
  const month = isMonth(m) ? m : monthOf(Date.now());
  return json({ month, rows: await payrollFor(month) });
});

/** Owners change pay: salary, a bonus or deduction, paid or not. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['payroll.manage']);
  const b = await readBody(req);
  await payAct(ctx, b as never);
  const month = isMonth(b.month) ? b.month : monthOf(Date.now());
  return json({ month, rows: await payrollFor(month) });
});
