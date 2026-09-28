import { requireStaff } from '@/lib/server/auth';
import { auditVersion, readAudit } from '@/lib/server/audit';
import { json, route } from '@/lib/server/http';

export const GET = route(async (req) => {
  await requireStaff(['audit.view']);
  const version = await auditVersion();
  if (new URL(req.url).searchParams.get('v') === String(version)) return json({ version, same: true });
  return json({ version, entries: await readAudit(1000) });
});
