import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
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

/** `{ action: 'create', code, pct, note }`, `{ action: 'toggle', code }` or `{ action: 'delete', code }`. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.promos']);
  const b = await readBody(req);
  const code = str(b.code, 24).toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(code)) fail(400, 'Codes are 3 to 24 letters and numbers.');
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (b.action === 'create') {
    const pct = int(b.pct, 1, 50);
    if (pct === null) fail(400, 'Between 1% and 50% off.');
    await updateSettings((s) => {
      if (s.promos.some((p) => p.code === code)) fail(409, 'That code already exists.');
      s.promos.push({ code, pct: pct!, active: true, uses: 0, createdAt: Date.now(), note: str(b.note, 80) });
    });
    await audit(actor, 'Created a promo code', `${code} · ${pct}% off`);
  } else if (b.action === 'toggle') {
    let on = false;
    await updateSettings((s) => {
      const p = s.promos.find((x) => x.code === code);
      if (!p) fail(404, 'No such code.');
      p!.active = on = !p!.active;
    });
    await audit(actor, on ? 'Switched on a promo code' : 'Switched off a promo code', code);
  } else if (b.action === 'delete') {
    await updateSettings((s) => {
      s.promos = s.promos.filter((p) => p.code !== code);
    });
    await audit(actor, 'Deleted a promo code', code);
  } else fail(400, 'Create, toggle or delete?');
  return json({ promos: await withUses() });
});
