/* Community Moments — customer uploaded café moments stored in KV.
   Key: brewns:moments (hash — id → JSON moment)
   
   Workflow:
   1. User uploads a moment on the website with photo, caption, location, author name.
   2. Moment is saved as status: 'pending'.
   3. Owner reviews submissions in the Dashboard / Console and clicks Approve.
   4. Approved moments render live in the aesthetic community gallery on the website.
*/

import { kv } from './store';
import { randomBytes } from 'node:crypto';
import { bumpLive } from './orders';

export interface Moment {
  id: string;
  imageUrl: string;      // file path or data URI (image or video)
  mediaType?: 'image' | 'video';
  author: string;        // e.g. "@maya.coffee" or "Maya R."
  name: string;          // Customer's name
  location: string;      // "Gulberg" | "DHA" | "Johar Town" | "Lahore"
  caption: string;       // Customer's story / aesthetic note
  product?: string;      // e.g. "Slow Roast Flat White" or "Iced Matcha"
  status: 'pending' | 'approved' | 'rejected';
  likes: number;
  createdAt: number;
  approvedAt?: number;
}

export function isVideoMedia(url: string, mediaType?: string): boolean {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url);
}

const KEY = 'moments';

const INITIAL_MOMENTS: Omit<Moment, 'id'>[] = [
  {
    imageUrl: '/assets/moments/latte-art.jpg',
    mediaType: 'image',
    author: '@zainab.brews',
    name: 'Zainab Q.',
    location: 'Gulberg',
    caption: 'Morning rituals at MM Alam Road. Perfect flat white crema before the city rushes in.',
    product: 'Slow Roast Flat White',
    status: 'approved',
    likes: 42,
    createdAt: Date.now() - 3600000 * 24 * 2,
    approvedAt: Date.now() - 3600000 * 24 * 2,
  },
  {
    imageUrl: '/assets/moments/iced-matcha.jpg',
    author: '@bilal.reads',
    name: 'Bilal H.',
    location: 'DHA',
    caption: 'Ceremonial grade iced matcha on the sunlit terrace. The oat milk swirl is pure art.',
    product: 'Iced Matcha Latte',
    status: 'approved',
    likes: 58,
    createdAt: Date.now() - 3600000 * 24 * 3,
    approvedAt: Date.now() - 3600000 * 24 * 3,
  },
  {
    imageUrl: '/assets/locations/inside/counter-new.jpg',
    author: '@tariq.visuals',
    name: 'Tariq A.',
    location: 'Gulberg',
    caption: 'Watching the baristas pull shots at 92°C with surgical precision. 4 minutes door-to-cup.',
    product: 'Cortado & Cardamom Bun',
    status: 'approved',
    likes: 37,
    createdAt: Date.now() - 3600000 * 24 * 4,
    approvedAt: Date.now() - 3600000 * 24 * 4,
  },
  {
    imageUrl: '/assets/locations/inside/table.webp',
    author: '@fatima_khan',
    name: 'Fatima K.',
    location: 'Johar Town',
    caption: 'Quiet corner on Main Boulevard with Slow Roast and an open notebook. Nobody rushes you.',
    product: 'Slow Roast · 250g',
    status: 'approved',
    likes: 29,
    createdAt: Date.now() - 3600000 * 24 * 5,
    approvedAt: Date.now() - 3600000 * 24 * 5,
  },
  {
    imageUrl: '/assets/locations/inside/espresso-machine.png',
    author: '@hamza_coffeelover',
    name: 'Hamza S.',
    location: 'Gulberg',
    caption: 'The dual-group beast behind every espresso pulled in Gulberg. Beautiful craftsmanship.',
    product: 'Double Shot Espresso',
    status: 'approved',
    likes: 64,
    createdAt: Date.now() - 3600000 * 24 * 6,
    approvedAt: Date.now() - 3600000 * 24 * 6,
  },
];

/** Ensures initial moments exist if empty */
async function ensureSeeded(): Promise<void> {
  const all = await kv.hall<Moment>(KEY);
  if (Object.keys(all).length === 0) {
    for (const m of INITIAL_MOMENTS) {
      const id = randomBytes(6).toString('hex');
      await kv.hset(KEY, id, { ...m, id });
    }
  }
}

/** Get all approved moments for public landing page (newest first). */
export async function listApprovedMoments(): Promise<Moment[]> {
  await ensureSeeded();
  const all = await kv.hall<Moment>(KEY);
  return Object.values(all)
    .map((m) => ({
      ...m,
      mediaType: m.mediaType || (isVideoMedia(m.imageUrl) ? 'video' : 'image'),
    }))
    .filter((m) => m.status === 'approved')
    .sort((a, b) => (b.approvedAt || b.createdAt) - (a.approvedAt || a.createdAt));
}

/** Get all moments for owner/staff dashboard (newest first). */
export async function listAllMoments(): Promise<Moment[]> {
  await ensureSeeded();
  const all = await kv.hall<Moment>(KEY);
  return Object.values(all)
    .map((m) => ({
      ...m,
      mediaType: m.mediaType || (isVideoMedia(m.imageUrl) ? 'video' : 'image'),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Count moments currently awaiting review/approval for real-time sidebar notification */
export async function countPendingMoments(): Promise<number> {
  const all = await kv.hall<Moment>(KEY);
  return Object.values(all || {}).filter((m) => m.status === 'pending').length;
}

/** Add a new customer moment (defaults to 'pending' until owner approves). */
export async function submitMoment(data: {
  imageUrl: string;
  mediaType?: 'image' | 'video';
  author: string;
  name: string;
  location: string;
  caption: string;
  product?: string;
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<Moment> {
  const id = randomBytes(6).toString('hex');
  const now = Date.now();
  const mediaType: 'image' | 'video' =
    data.mediaType || (isVideoMedia(data.imageUrl) ? 'video' : 'image');
  const status = data.status || 'pending';
  const moment: Moment = {
    id,
    imageUrl: data.imageUrl,
    mediaType,
    author: data.author.trim().startsWith('@') ? data.author.trim() : `@${data.author.trim()}`,
    name: data.name.trim(),
    location: data.location.trim(),
    caption: data.caption.trim(),
    product: data.product?.trim() || '',
    status,
    likes: 0,
    createdAt: now,
    approvedAt: status === 'approved' ? now : undefined,
  };
  await kv.hset(KEY, id, moment);
  await bumpLive().catch(() => {});
  return moment;
}

/** Owner approves a moment to publish it live to the website. */
export async function approveMoment(id: string): Promise<Moment | null> {
  const moment = await kv.hget<Moment>(KEY, id);
  if (!moment) return null;
  moment.status = 'approved';
  moment.approvedAt = Date.now();
  await kv.hset(KEY, id, moment);
  await bumpLive().catch(() => {});
  return moment;
}

/** Owner rejects a moment. */
export async function rejectMoment(id: string): Promise<Moment | null> {
  const moment = await kv.hget<Moment>(KEY, id);
  if (!moment) return null;
  moment.status = 'rejected';
  await kv.hset(KEY, id, moment);
  await bumpLive().catch(() => {});
  return moment;
}

/** Delete a moment completely. */
export async function deleteMoment(id: string): Promise<boolean> {
  const moment = await kv.hget<Moment>(KEY, id);
  if (!moment) return false;
  await kv.hdel(KEY, id);
  await bumpLive().catch(() => {});
  return true;
}

/** Like / upvote a moment. */
export async function likeMoment(id: string): Promise<number | null> {
  const moment = await kv.hget<Moment>(KEY, id);
  if (!moment) return null;
  moment.likes = (moment.likes || 0) + 1;
  await kv.hset(KEY, id, moment);
  return moment.likes;
}
