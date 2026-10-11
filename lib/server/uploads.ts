/* What an upload really is, and which links may be shown on the site.

   A visitor can send any file with any name and any "type", so none of those are
   believed. The file is identified by its first bytes, only a short list of photo
   and video formats is accepted (never SVG or HTML, which can carry scripts), the
   extension on disk comes from what the file is rather than what it was called,
   and a link is shown only if it points at our own assets or a known image host.
   Pure, so the tests can use it without a server. */

export type Media = { kind: 'image' | 'video'; mime: string; ext: string };

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
/** Hosts a moment's picture may be linked from. Matches the image hosts in next.config.mjs. */
export const MEDIA_HOSTS = ['res.cloudinary.com', 'images.unsplash.com'] as const;

const ascii = (b: Uint8Array, at: number, text: string) => text.split('').every((ch, i) => b[at + i] === ch.charCodeAt(0));
const bytes = (b: Uint8Array, at: number, want: number[]) => want.every((v, i) => b[at + i] === v);

/** What these first bytes are, or null if they are not a photo or video we accept. */
export function sniffMedia(b: Uint8Array): Media | null {
  if (b.length < 12) return null;
  if (bytes(b, 0, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (bytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (bytes(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  if (ascii(b, 0, 'OggS')) return { kind: 'video', mime: 'video/ogg', ext: 'ogg' };
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'avif' || brand === 'avis') return { kind: 'image', mime: 'image/avif', ext: 'avif' };
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime', ext: 'mov' };
    if (/^(isom|iso\d|mp4\d|avc1|M4V |M4A |dash|3gp\d)/.test(brand)) return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  }
  return null;
}

export type Checked = { ok: true; buffer: Buffer; media: Media } | { ok: false; status: number; error: string };

/** Reads an uploaded file and checks it: a supported type by its bytes, and within the size limit for that type. */
export async function checkUpload(file: { size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Checked> {
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, status: 413, error: 'That file is too large.' };
  const buffer = Buffer.from(await file.arrayBuffer());
  const media = sniffMedia(buffer);
  if (!media) return { ok: false, status: 415, error: 'That file type is not supported. Use a JPG, PNG, WebP, GIF, MP4 or WebM.' };
  if (media.kind === 'image' && buffer.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: 'That photo is too large (max 10 MB).' };
  if (media.kind === 'video' && buffer.length > MAX_VIDEO_BYTES) return { ok: false, status: 413, error: 'That video is too large (max 60 MB).' };
  return { ok: true, buffer, media };
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif|avif)|video\/(?:mp4|webm|quicktime|ogg));base64,([A-Za-z0-9+/]+={0,2})$/;
/** A pasted image or video as a data: link must be what it says, and not enormous (these are stored in the database). */
export const MAX_DATA_URL_CHARS = 6 * 1024 * 1024;

/**
 * The link if it is safe to show on the site, else null: one of our own /assets/ paths, a link on a known
 * image host, or a data: picture or video whose bytes match its label. javascript:, other hosts, protocol-
 * relative links and paths that climb out of /assets/ are all refused.
 */
export function safeMediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!url || url.length > MAX_DATA_URL_CHARS) return null;
  if (url.startsWith('data:')) {
    const m = DATA_URL.exec(url);
    if (!m) return null;
    const head = Buffer.from(m[2].slice(0, 32), 'base64');
    const media = sniffMedia(head);
    return media && media.mime === m[1] ? url : null;
  }
  if (url.startsWith('/')) {
    return /^\/assets\/[A-Za-z0-9._\-/]+$/.test(url) && !url.includes('..') && !url.includes('//') ? url : null;
  }
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && (MEDIA_HOSTS as readonly string[]).includes(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
