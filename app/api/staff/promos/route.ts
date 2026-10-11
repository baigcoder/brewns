import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { pkDay } from '@/lib/orderFlow';
import { PROMO_MAX_PCT } from '@/lib/promos';
import { fail, int, json, readBody, route, str } from '@/lib/server/http';
import { getSettings, updateSettings } from '@/lib/server/settings';
import { kv } from '@/lib/server/store';

const withUses = async () => {
  const s = await getSettings();
  return Promise.all(s.promos.map(async (p) => ({ ...p, uses: await kv.num(`promo-uses:${p.code}`) })));
};

export const GET = route(async () => {
  await requireStaff(['menu.promos']);
  return json({ promos: await withUses() });
});

/** `{ action: 'create', code, pct, note, hint? }`, `{ action: 'toggle', code }`, `{ action: 'hint', code }` (suggest this one at checkout, or stop) or `{ action: 'delete', code }`. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.promos']);
  const b = await readBody(req);
  const code = str(b.code, 24).toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(code)) fail(400, 'Codes are 3 to 24 letters and numbers.');
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (b.action === 'create') {
    const pct = int(b.pct, 1, PROMO_MAX_PCT);
    if (pct === null) fail(400, `Between 1% and ${PROMO_MAX_PCT}% off.`);
    // Optional rules. Empty or zero means "no limit".
    const wants = (v: unknown) => v !== undefined && v !== null && v !== '' && Number(v) !== 0;
    const maxUses = wants(b.maxUses) ? int(b.maxUses, 1, 1_000_000) : undefined;
    if (maxUses === null) fail(400, 'How many uses? A whole number, or leave it empty for no limit.');
    const minTotal = wants(b.minTotal) ? int(b.minTotal, 1, 1_000_000) : undefined;
    if (minTotal === null) fail(400, 'The minimum order is a whole number of rupees, or leave it empty.');
    const expires = str(b.expires, 10);
    if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires < pkDay(Date.now()))) fail(400, 'Pick an end date from today on.');
    const rules = { ...(maxUses ? { maxUses } : {}), ...(minTotal ? { minTotal } : {}), ...(expires ? { expires } : {}), ...(b.oncePerCustomer ? { oncePerCustomer: true } : {}) };
    await updateSettings((s) => {
      if (s.promos.some((p) => p.code === code)) fail(409, 'That code already exists.');
      if (b.hint) s.promos.forEach((p) => delete p.hint);
      s.promos.push({ code, pct: pct!, active: true, ...(b.hint ? { hint: true } : {}), uses: 0, createdAt: Date.now(), note: str(b.note, 80), ...rules });
    });
    await audit(actor, 'Created a promo code', `${code} · ${pct}% off${Object.keys(rules).length ? ` · ${Object.entries(rules).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}`);
  } else if (b.action === 'toggle') {
    let on = false;
    await updateSettings((s) => {
      const p = s.promos.find((x) => x.code === code);
      if (!p) fail(404, 'No such code.');
      p!.active = on = !p!.active;
    });
    await audit(actor, on ? 'Switched on a promo code' : 'Switched off a promo code', code);
  } else if (b.action === 'hint') {
    let shown = false;
    await updateSettings((s) => {
      const p = s.promos.find((x) => x.code === code);
      if (!p) fail(404, 'No such code.');
      shown = !p!.hint;
      s.promos.forEach((x) => delete x.hint); // only one code is ever suggested
      if (shown) p!.hint = true;
    });
    await audit(actor, shown ? 'Now suggesting a promo code on the site' : 'Stopped suggesting a promo code on the site', code);
  } else if (b.action === 'delete') {
    await updateSettings((s) => {
      s.promos = s.promos.filter((p) => p.code !== code);
    });
    await audit(actor, 'Deleted a promo code', code);
  } else fail(400, 'Create, toggle, suggest or delete?');
  return json({ promos: await withUses() });
});
