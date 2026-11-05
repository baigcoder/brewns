import { requireStaff } from '@/lib/server/auth';
import { auditVersion, readAudit } from '@/lib/server/audit';
import { json, notModified, route, versionEtag } from '@/lib/server/http';

export const GET = route(async (req) => {
  const ctx = await requireStaff(['audit.view']);
  const version = await auditVersion();
  const etag = versionEtag('staff-audit', version, `${ctx.user.id}-${ctx.user.v}`);
  const unchanged = new URL(req.url).searchParams.get('v') === String(version);
  const cached = notModified(req, etag);
  if (cached && unchanged) return cached;
  if (unchanged) return json({ version, same: true }, 200, { ETag: etag, 'Cache-Control': 'private, no-cache' });
  return json({ version, entries: await readAudit(1000) }, 200, { ETag: etag, 'Cache-Control': 'private, no-cache' });
});
