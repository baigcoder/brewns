import { catalogItem } from '@/lib/catalog';
import { route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A menu photo kept in the database (when Cloudinary could not take it). Its link carries a version, so the
 * CDN may keep it for good. Served only as the picture type it was checked to be, never as a page.
 */
export const GET = route(async (_req: Request, c: Ctx) => {
  const item = catalogItem((await c.params).id);
  const photo = item ? await kv.get<{ mime: string; b64: string }>(`menuphoto:${item.id}`) : null;
  if (!photo || !/^image\/(jpeg|png|webp|gif|avif)$/.test(photo.mime)) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(photo.b64, 'base64'), {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
