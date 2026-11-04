import { revalidatePath } from 'next/cache';
import { CATALOG, catalogItem } from '@/lib/catalog';
import { productImage } from '@/lib/products';
import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { isCloudinaryConfigured, uploadMediaToCloudinary } from '@/lib/server/cloudinary';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { copyBuiltInPhotos } from '@/lib/server/menuPhotos';
import { getSettings, updateSettings } from '@/lib/server/settings';
import { kv } from '@/lib/server/store';
import { checkMenuPhoto, safeMediaUrl } from '@/lib/server/uploads';

/**
 * An item's photo on the site. A form with `id` and `file` uploads a new one to Cloudinary and shows it
 * everywhere the item appears; if Cloudinary is missing or refuses (a key without upload rights, say), the
 * photo is kept in the database and served from /api/public/photo. JSON `{ id, reset: true }` goes back to
 * the built-in picture. JSON `{ copyAll: true }` moves every built-in picture to Cloudinary as the item's photo,
 * so each one can be replaced from here.
 */
/** The shop and coffee pages are built ahead; these rebuild them on their next visit with the new photo. */
const refreshPages = () => {
  revalidatePath('/shop', 'layout');
  revalidatePath('/coffee');
};

// Copying the whole menu uploads a few dozen pictures in one request.
export const maxDuration = 60;

export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.photos']);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };

  if (!(req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    const b = await readBody(req);
    if (b.copyAll === true) {
      if (!isCloudinaryConfigured()) return fail(503, 'Cloudinary is not connected, so there is nowhere to copy the photos to.');
      const origin = new URL(req.url).origin;
      const items = CATALOG.filter((p) => !p.gift).map((p) => ({ id: p.id, name: p.name, image: productImage(p) }));
      const result = await copyBuiltInPhotos(
        items,
        (await getSettings()).photos,
        async (path) => {
          // Fetched from the site itself: on Vercel the public folder is served, not on the function's disk.
          const res = await fetch(origin + path, { cache: 'no-store' });
          if (!res.ok) throw new Error(`${path}: ${res.status}`);
          return Buffer.from(await res.arrayBuffer());
        },
        async (id, buffer) => {
          const up = await uploadMediaToCloudinary(buffer, { folder: 'brewns/menu', publicId: id, resourceType: 'image', tags: ['brewns', 'menu'] });
          const url = safeMediaUrl(up.secureUrl);
          if (!url) throw new Error('Cloudinary sent back an unexpected link.');
          return url;
        },
      );
      // Merged into the latest settings, so a photo uploaded meanwhile is not overwritten.
      const s = await updateSettings((s) => {
        for (const [id, url] of Object.entries(result.added)) if (!s.photos[id]) s.photos[id] = url;
      });
      if (result.copied) {
        await bumpLive();
        refreshPages();
        await audit(actor, 'Copied the built-in menu photos to Cloudinary', `${result.copied} photos`);
      }
      return json({ photos: s.photos, copied: result.copied, skipped: result.skipped, failed: result.failed });
    }
    const item = catalogItem(str(b.id, 60));
    if (!item || !b.reset) return fail(400, 'Which item, and what to do?');
    const s = await updateSettings((s) => void delete s.photos[item.id]);
    await kv.del(`menuphoto:${item.id}`);
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

  // One picture per item, replaced in place; either link carries a new version, so nobody sees the old one cached.
  let url: string | null = null;
  if (isCloudinaryConfigured()) {
    try {
      const res = await uploadMediaToCloudinary(up.buffer, { folder: 'brewns/menu', publicId: item!.id, resourceType: 'image', tags: ['brewns', 'menu'] });
      url = safeMediaUrl(res.secureUrl);
    } catch (e) {
      console.warn('[menu photo] Cloudinary refused the upload, so it is kept in the database:', (e as Error).message);
    }
  }
  if (!url) {
    const v = Date.now().toString(36);
    await kv.set(`menuphoto:${item!.id}`, { mime: up.media.mime, b64: up.buffer.toString('base64'), v });
    url = `/api/public/photo/${item!.id}?v=${v}`;
  } else await kv.del(`menuphoto:${item!.id}`);
  const s = await updateSettings((s) => void (s.photos[item!.id] = url!));
  await bumpLive();
  refreshPages();
  await audit(actor, 'Uploaded a new menu photo', item!.name);
  return json({ photos: s.photos });
});
