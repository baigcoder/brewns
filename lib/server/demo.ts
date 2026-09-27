/* Leftover sample orders. The console no longer makes sample data; this only
   clears what an older version loaded. It removes nothing but orders marked
   `demo: true`, so real orders and real accounts are never touched. */

import type { ServerOrder } from '@/lib/orderFlow';
import { kv } from './store';
import { bumpLive } from './orders';

export async function clearDemo() {
  const days = (await kv.get<string[]>('demo:days')) || [];
  let n = 0;
  for (const day of days) {
    const demo = Object.values(await kv.hall<ServerOrder>(`orders:day:${day}`)).filter((o) => o.demo).map((o) => o.number);
    if (!demo.length) continue;
    await kv.hdel(`orders:day:${day}`, ...demo);
    await kv.hdel('orders:where', ...demo);
    await kv.hdel('orders:active', ...demo);
    n += demo.length;
  }
  await kv.del('demo:days');
  await bumpLive();
  return { removed: n };
}

export const hasDemo = async () => !!(await kv.get<string[]>('demo:days'))?.length;
