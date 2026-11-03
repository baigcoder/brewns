import { existsSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import type { Product } from '@/lib/catalog';
import { productImage } from '@/lib/products';
import { getSettings } from './settings';

/** The owner's own photos (Menu → Menu photos), read once per page render. */
export const ownPhotos = cache(async () => (await getSettings()).photos);

/** The owner's photo of the product if there is one, else its picture if the file is really there, so a page never shows a broken image. */
export function imageFor(p: Product, photos: Record<string, string> = {}): string | null {
  if (photos[p.id]) return photos[p.id];
  const url = productImage(p);
  if (!url) return null;
  try {
    return existsSync(path.join(process.cwd(), 'public', url)) ? url : null;
  } catch {
    return null;
  }
}
