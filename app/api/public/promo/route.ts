import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { pkDay } from '@/lib/orderFlow';
import { promoProblem } from '@/lib/promos';
import { REFERRAL, refAmount, refProblem } from '@/lib/referral';
import { currentCustomer } from '@/lib/server/auth';
import { findRefCode } from '@/lib/server/referrals';
import { getSettings } from '@/lib/server/settings';
import { kv } from '@/lib/server/store';

/** Checks a promo code at checkout: one of the café's, or a customer's referral or thank-you code. */
export const POST = route(async (req) => {
  await rateLimit(`promo:${clientIp(req)}`, 30, 600, 'Too many codes tried. Wait a few minutes.');
  const code = str((await readBody(req)).code, 24).toUpperCase();
  const promo = (await getSettings()).promos.find((p) => p.active && p.code === code);
  if (!promo) {
    const ref = await findRefCode(code);
    if (!ref) return json({ valid: false });
    // The mobile and the minimum are checked when the order is placed; who is signed in is known now.
    const why = refProblem(ref, { customerId: (await currentCustomer())?.id || null, phone: '' });
    if (why) return json({ valid: false, reason: why });
    return json({ valid: true, code, pct: 0, off: refAmount(ref), ...(ref.kind === 'invite' ? { minTotal: REFERRAL.minOrder } : {}) });
  }
  // What can be known before an order exists: has it ended or been used up? The minimum and once-each are checked when the order is placed.
  const why = promoProblem(promo, { uses: await kv.num(`promo-uses:${promo.code}`), today: pkDay(Date.now()) });
  if (why) return json({ valid: false, reason: why });
  return json({ valid: true, code: promo.code, pct: promo.pct, ...(promo.minTotal ? { minTotal: promo.minTotal } : {}) });
});
