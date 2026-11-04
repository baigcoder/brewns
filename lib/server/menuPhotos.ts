/* Moving the built-in menu pictures to Cloudinary, so every item's photo is the
   owner's to change. Items that already have the owner's photo are left alone. */

export type CopyResult = { added: Record<string, string>; copied: number; skipped: number; failed: string[] };

export async function copyBuiltInPhotos(
  items: { id: string; name: string; image: string | null }[],
  own: Record<string, string>,
  fetchImage: (path: string) => Promise<Buffer>,
  upload: (id: string, buffer: Buffer) => Promise<string>,
  batch = 6,
): Promise<CopyResult> {
  const todo = items.filter((p) => p.image && !own[p.id]);
  const out: CopyResult = { added: {}, copied: 0, skipped: items.length - todo.length, failed: [] };
  // A few at a time: fast enough for one request, gentle on Cloudinary's rate limit.
  for (let i = 0; i < todo.length; i += batch) {
    await Promise.all(
      todo.slice(i, i + batch).map(async (p) => {
        try {
          out.added[p.id] = await upload(p.id, await fetchImage(p.image!));
          out.copied += 1;
        } catch {
          out.failed.push(p.name);
        }
      }),
    );
  }
  return out;
}
