/* Payroll storage and the owner's actions on it.
   pay:plan          user id → PayPlan (salary and pay day)
   pay:<YYYY-MM>     user id → PayMonth (that month's changes, and the payment once made) */

import { DEFAULT_PAY_DAY, isMonth, MAX_PAY, monthBase, monthLabel, monthOf, PAY_KINDS, PAY_METHODS, payTotals, shiftMonth, type PayKind, type PayMonth, type PayPlan } from '@/lib/payroll';
import { ROLE_INFO } from '@/lib/rbac';
import { SITE_URL } from '@/lib/site';
import { audit } from './audit';
import { allUsers, getUser, randomToken, type StaffContext, type User } from './auth';
import { renderLinkEmail, sendEmail } from './email';
import { fail, str } from './http';
import { kv, withLock } from './store';

const monthKey = (m: string) => `pay:${m}`;
const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

export type PayRow = {
  id: string;
  name: string;
  role: string;
  photo: string;
  active: boolean;
  plan: PayPlan | null;
  month: PayMonth;
  totals: ReturnType<typeof payTotals>;
};

const rowFor = (u: User, plan: PayPlan | null, month: PayMonth | null): PayRow => {
  const m = month || { items: [] };
  return { id: u.id, name: u.name, role: u.role, photo: u.photo || '', active: u.active, plan, month: m, totals: payTotals(monthBase(plan, m), m.items) };
};

/** Everyone on staff who has joined (and anyone switched off who still has pay that month), for the owner's payroll page. Owners pay themselves out of the business, not a salary here. */
export async function payrollFor(month: string) {
  const [users, plans, months] = await Promise.all([allUsers('staff'), kv.hall<PayPlan>('pay:plan'), kv.hall<PayMonth>(monthKey(month))]);
  return users
    .filter((u) => u.role !== 'customer' && u.role !== 'owner' && u.passHash && (u.active || months[u.id]))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((u) => rowFor(u, plans[u.id] || null, months[u.id] || null));
}

/** Your own pay: this month and the five before it. */
export async function myPay(user: User, now = Date.now()) {
  const plan = await kv.hget<PayPlan>('pay:plan', user.id);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(now), -i));
  const records = await Promise.all(months.map((m) => kv.hget<PayMonth>(monthKey(m), user.id)));
  return {
    plan,
    months: months
      .map((m, i) => ({ ...rowFor(user, plan, records[i]), ym: m }))
      // the months before a salary was set, with nothing in them, say nothing
      .filter((r, i) => i === 0 || r.month.items.length || r.month.paid),
  };
}

type Act =
  | { action: 'plan'; userId: string; salary: number; payDay?: number }
  | { action: 'item'; userId: string; month: string; kind: PayKind; amount: number; note?: string }
  | { action: 'unitem'; userId: string; month: string; itemId: string }
  | { action: 'paid'; userId: string; month: string; method: string; ref?: string }
  | { action: 'unpaid'; userId: string; month: string };

const amountOf = (v: unknown, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_PAY) fail(400, `${what}: a whole number of rupees, up to ${MAX_PAY.toLocaleString('en-US')}.`);
  return n;
};

/** The owner changes pay. Only owners: salaries are nobody else's business. */
export async function payAct(ctx: StaffContext, b: Act) {
  if (ctx.role !== 'owner') fail(403, 'Only an owner can change pay.');
  const target = await getUser(String(b.userId || ''));
  if (!target || target.kind !== 'staff' || target.role === 'customer') return fail(404, 'No such team member.') as never;
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };

  if (b.action === 'plan') {
    const salary = amountOf(b.salary, 'Salary');
    const payDay = b.payDay === undefined ? DEFAULT_PAY_DAY : Number(b.payDay);
    if (!Number.isInteger(payDay) || payDay < 1 || payDay > 28) fail(400, 'Pay day: a day from 1 to 28.');
    await kv.hset('pay:plan', target.id, { salary, payDay } satisfies PayPlan);
    await audit(actor, `Set ${target.name}'s salary to ${money(salary)} a month`, `Paid on day ${payDay}`);
    return;
  }

  if (!isMonth(b.month)) fail(400, 'Which month?');
  const month = b.month;
  let paidNow: PayMonth['paid'] | null = null;
  await withLock(`pay:${month}:${target.id}`, async () => {
    const rec: PayMonth = (await kv.hget<PayMonth>(monthKey(month), target.id)) || { items: [] };
    const label = monthLabel(month);
    if (b.action === 'unpaid') {
      if (!rec.paid) fail(409, `${label} isn't marked paid.`);
      delete rec.paid;
      await audit(actor, `Marked ${target.name}'s ${label} pay as not paid`);
    } else {
      if (rec.paid) fail(409, `${label} is already paid. Mark it not paid first to change it.`);
      if (b.action === 'item') {
        if (!(b.kind in PAY_KINDS)) fail(400, 'Bonus, overtime, deduction or advance?');
        const amount = amountOf(b.amount, 'Amount');
        if (!amount) fail(400, 'Enter an amount.');
        const note = str(b.note, 80).trim();
        if (PAY_KINDS[b.kind].sign < 0 && note.length < 3) fail(400, 'Say why, so they know what it was for.');
        rec.items.push({ id: randomToken(6), kind: b.kind, amount, note, at: Date.now(), by: ctx.user.name });
        await audit(actor, `${PAY_KINDS[b.kind].label} for ${target.name}: ${money(amount)}`, `${label}${note ? ` · ${note}` : ''}`);
      } else if (b.action === 'unitem') {
        const item = rec.items.find((i) => i.id === b.itemId);
        if (!item) fail(404, 'That line is already gone.');
        rec.items = rec.items.filter((i) => i.id !== b.itemId);
        await audit(actor, `Removed a ${PAY_KINDS[item!.kind].label.toLowerCase()} for ${target.name}`, `${label} · ${money(item!.amount)}`);
      } else if (b.action === 'paid') {
        const method = PAY_METHODS.find((m) => m === b.method);
        if (!method) fail(400, 'How was it paid?');
        const base = monthBase(await kv.hget<PayPlan>('pay:plan', target.id), rec);
        const { net } = payTotals(base, rec.items);
        rec.paid = paidNow = { at: Date.now(), by: ctx.user.name, method: method!, ref: str(b.ref, 40).trim(), base, net };
        await audit(actor, `Paid ${target.name} ${money(net)} for ${label}`, `${method}${rec.paid.ref ? ` · ${rec.paid.ref}` : ''}`);
      } else fail(400, 'Unknown action.');
    }
    await kv.hset(monthKey(month), target.id, rec);
  });

  // They hear about it: what was paid and how it adds up.
  if (paidNow) {
    const p = paidNow as NonNullable<PayMonth['paid']>;
    const rec = (await kv.hget<PayMonth>(monthKey(month), target.id))!;
    const t = payTotals(p.base, rec.items);
    const lines = [
      `Your ${monthLabel(month)} pay of ${money(p.net)} has been paid by ${p.method.toLowerCase()}${p.ref ? ` (reference ${p.ref})` : ''}.`,
      `Salary ${money(t.base)}${t.add ? ` + additions ${money(t.add)}` : ''}${t.less ? ` − deductions ${money(t.less)}` : ''} = ${money(t.net)}.`,
      ...rec.items.map((i) => `${PAY_KINDS[i.kind].label}: ${money(i.amount)}${i.note ? ` · ${i.note}` : ''}`),
    ];
    const link = `${SITE_URL}/dashboard/account`;
    await sendEmail({
      to: target.email,
      subject: `brewns · your ${monthLabel(month)} pay`,
      text: `Hi ${target.name.split(' ')[0]},\n\n${lines.join('\n')}\n\nSee every month on your account: ${link}\n\n${ctx.user.name}, brewns coffee house`,
      html: renderLinkEmail({
        preview: `Your ${monthLabel(month)} pay of ${money(p.net)} has been paid.`,
        heading: `${monthLabel(month)} pay: ${money(p.net)}`,
        lines: [`Hi ${target.name.split(' ')[0]},`, ...lines],
        button: 'See my pay',
        link,
        note: `Questions about it? Ask ${ctx.user.name}. You're on the team as ${ROLE_INFO[target.role as keyof typeof ROLE_INFO]?.label.toLowerCase() || 'staff'}.`,
        signoff: `${ctx.user.name}, brewns coffee house`,
      }),
    }).catch(() => null);
  }
}
