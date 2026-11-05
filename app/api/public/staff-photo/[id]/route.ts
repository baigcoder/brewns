import { route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';

type Ctx = { params: Promise<{ id: string }> };

/** A team member's photo kept in the database (when Cloudinary could not take it). Versioned link, so cached for good. */
export const GET = route(async (_req: Request, c: Ctx) => {
  const id = (await c.params).id;
  const photo = /^[\w-]{3,40}$/.test(id) ? await kv.get<{ mime: string; b64: string }>(`staffphoto:${id}`) : null;
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
