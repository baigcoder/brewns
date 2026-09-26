import { requireStaff } from '@/lib/server/auth';
import { readAudit } from '@/lib/server/audit';
import { json, route } from '@/lib/server/http';

export const GET = route(async () => {
  await requireStaff(['audit.view']);
  return json({ entries: await readAudit(500) });
});
