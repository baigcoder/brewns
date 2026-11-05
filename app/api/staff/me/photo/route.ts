import { publicUser, requireStaff, saveUser } from '@/lib/server/auth';
import { isCloudinaryConfigured, uploadMediaToCloudinary } from '@/lib/server/cloudinary';
import { fail, json, readBody, route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';
import { checkMenuPhoto, safeMediaUrl } from '@/lib/server/uploads';

/**
 * Your own photo, shown to customers when you are their rider or served their table. A form with `file`
 * uploads it (to Cloudinary, else kept in the database and served from /api/public/staff-photo);
 * JSON `{ remove: true }` takes it down.
 */
export const POST = route(async (req) => {
  const ctx = await requireStaff();
  const me = ctx.user;
  if (!(req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    if ((await readBody(req)).remove !== true) fail(400, 'Send a photo, or ask to remove it.');
    await kv.del(`staffphoto:${me.id}`);
    const next = { ...me, photo: '' };
    await saveUser(next, me);
    return json({ user: publicUser(next) });
  }
  const form = await req.formData().catch(() => fail(400, 'Send the photo as a form.'));
  const file = form.get('file');
  if (!(file instanceof Blob)) return fail(400, 'Choose a photo to upload.');
  const up = await checkMenuPhoto(file);
  if (!up.ok) return fail(up.status, up.error);

  let url: string | null = null;
  if (isCloudinaryConfigured()) {
    try {
      const res = await uploadMediaToCloudinary(up.buffer, { folder: 'brewns/staff', publicId: me.id, resourceType: 'image', tags: ['brewns', 'staff'] });
      url = safeMediaUrl(res.secureUrl);
    } catch (e) {
      console.warn('[staff photo] Cloudinary refused the upload, so it is kept in the database:', (e as Error).message);
    }
  }
  if (!url) {
    const v = Date.now().toString(36);
    await kv.set(`staffphoto:${me.id}`, { mime: up.media.mime, b64: up.buffer.toString('base64'), v });
    url = `/api/public/staff-photo/${me.id}?v=${v}`;
  } else await kv.del(`staffphoto:${me.id}`);
  const next = { ...me, photo: url };
  await saveUser(next, me);
  return json({ user: publicUser(next) });
});
