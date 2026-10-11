import { requireCustomer } from '@/lib/server/auth';
import { exportCustomer } from '@/lib/server/customers';
import { route } from '@/lib/server/http';

/** Everything we keep about the signed-in customer, as a JSON file to download. */
export const GET = route(async () => {
  const user = await requireCustomer();
  const data = await exportCustomer(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="brewns-my-data.json"',
      'Cache-Control': 'no-store',
    },
  });
});
