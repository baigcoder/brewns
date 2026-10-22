import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Product } from '@/lib/catalog';
import { productImage } from '@/lib/products';

/** The product's picture if the file is really there, so a page never shows a broken image. */
export function imageFor(p: Product): string | null {
  const url = productImage(p);
  if (!url) return null;
  try {
    return existsSync(path.join(process.cwd(), 'public', url)) ? url : null;
  } catch {
    return null;
  }
}
