import { REFERRAL } from '@/lib/referral';
import { requireCustomer } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { openThanks, referralOf } from '@/lib/server/referrals';

/** The signed-in customer's code to share, how it has gone, and the thank-you codes they can spend. */
export const GET = route(async () => {
  const u = await requireCustomer();
  const [r, credits] = await Promise.all([referralOf(u), openThanks(u.id)]);
  return json({ ...r, credits, give: REFERRAL.give, get: REFERRAL.get, minOrder: REFERRAL.minOrder });
});
