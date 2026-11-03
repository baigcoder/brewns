import { revalidatePath } from 'next/cache';
import { catalogItem } from '@/lib/catalog';
import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { isCloudinaryConfigured, uploadMediaToCloudinary } from '@/lib/server/cloudinary';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { updateSettings } from '@/lib/server/settings';
import { checkMenuPhoto, safeMediaUrl } from '@/lib/server/uploads';

/**
 * An item's photo on the site. A form with `id` and `file` uploads a new one to Cloudinary and shows it
 * everywhere the item appears; JSON `{ id, reset: true }` goes back to the built-in picture.
 */
/** The shop and coffee pages are built ahead; these rebuild them on their next visit with the new photo. */
const refreshPages = () => {
  revalidatePath('/shop', 'layout');
  revalidatePath('/coffee');
};

export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.photos']);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };

  if (!(req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    const b = await readBody(req);
    const item = catalogItem(str(b.id, 60));
    if (!item || !b.reset) return fail(400, 'Which item, and what to do?');
    const s = await updateSettings((s) => void delete s.photos[item.id]);
    await bumpLive();
    refreshPages();
    await audit(actor, 'Put back the original menu photo', item.name);
    return json({ photos: s.photos });
  }

  const form = await req.formData().catch(() => fail(400, 'Send the photo as a form.'));
  const item = catalogItem(str(form.get('id'), 60));
  if (!item) fail(404, 'No such item.');
  const file = form.get('file');
  if (!(file instanceof Blob)) return fail(400, 'Choose a photo to upload.');
  const up = await checkMenuPhoto(file);
  if (!up.ok) return fail(up.status, up.error);
  if (!isCloudinaryConfigured()) fail(503, 'Photo storage (Cloudinary) is not set up on the server.');

  // One picture per item, replaced in place; the link carries a new version, so nobody sees the old one cached.
  const res = await uploadMediaToCloudinary(up.buffer, { folder: 'brewns/menu', publicId: item!.id, resourceType: 'image', tags: ['brewns', 'menu'] });
  const url = safeMediaUrl(res.secureUrl);
  if (!url) fail(502, 'The photo storage sent back a link we do not show. Try again.');
  const s = await updateSettings((s) => void (s.photos[item!.id] = url!));
  await bumpLive();
  refreshPages();
  await audit(actor, 'Uploaded a new menu photo', item!.name);
  return json({ photos: s.photos });
});
