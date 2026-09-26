import { requireStaff } from '@/lib/server/auth';
import { fail, json, readBody, route } from '@/lib/server/http';
import { staffAct, staffView, type Action } from '@/lib/server/orders';

type Ctx = { params: Promise<{ number: string }> };

/** One step on one order. Which steps a role may take is decided in staffAct. */
export const POST = route(async (req: Request, c: Ctx) => {
  const ctx = await requireStaff();
  const number = Number((await c.params).number);
  if (!Number.isInteger(number)) fail(400, 'Which order?');
  const action = await readBody<Action>(req);
  const o = await staffAct(number, action, ctx);
  return json({ order: staffView(o, ctx) });
});
