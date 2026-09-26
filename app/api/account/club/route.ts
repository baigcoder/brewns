import { requireCustomer } from '@/lib/server/auth';
import { clubOf, importClub, joinClub, leaveClub } from '@/lib/server/customers';
import { fail, json, readBody, route, str } from '@/lib/server/http';

/** Join or leave the club, or bring this device's card into the account. */
export const POST = route(async (req) => {
  const u = await requireCustomer();
  const b = await readBody(req);
  if (b.action === 'join') {
    const birthday = str(b.birthday, 5);
    if (birthday && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday)) fail(400, 'Pick both the day and the month, or neither.');
    return json({ club: await joinClub(u, birthday) });
  }
  if (b.action === 'leave') return json({ club: await leaveClub(u) });
  if (b.action === 'import') {
    const { state, imported } = await importClub(u, b.club);
    return json({ club: state, imported });
  }
  if (b.action === 'get') return json({ club: await clubOf(u) });
  return fail(400, 'Join, leave or import?');
});
