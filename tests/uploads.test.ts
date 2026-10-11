import { describe, expect, it } from 'bun:test';
import { MAX_IMAGE_BYTES, checkUpload, safeMediaUrl, sniffMedia } from '@/lib/server/uploads';

const pad = (head: number[], len = 32) => Uint8Array.from([...head, ...new Array(Math.max(0, len - head.length)).fill(0)]);
const text = (s: string, at = 0, len = 32) => {
  const a = new Uint8Array(len);
  [...s].forEach((c, i) => (a[at + i] = c.charCodeAt(0)));
  return a;
};
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MP4 = text('ftypisom', 4);
const WEBP = (() => {
  const a = text('RIFF');
  [...'WEBP'].forEach((c, i) => (a[8 + i] = c.charCodeAt(0)));
  return a;
})();
const b64 = (a: Uint8Array) => Buffer.from(a).toString('base64');

describe('sniffMedia', () => {
  it('knows the photo and video formats by their first bytes', () => {
    expect(sniffMedia(JPEG)).toEqual({ kind: 'image', mime: 'image/jpeg', ext: 'jpg' });
    expect(sniffMedia(PNG)?.ext).toBe('png');
    expect(sniffMedia(text('GIF89a'))?.ext).toBe('gif');
    expect(sniffMedia(WEBP)?.ext).toBe('webp');
    expect(sniffMedia(pad([0x1a, 0x45, 0xdf, 0xa3]))?.mime).toBe('video/webm');
    expect(sniffMedia(MP4)).toEqual({ kind: 'video', mime: 'video/mp4', ext: 'mp4' });
    expect(sniffMedia(text('ftypqt  ', 4))?.ext).toBe('mov');
    expect(sniffMedia(text('ftypavif', 4))?.mime).toBe('image/avif');
  });

  it('refuses everything that is not a photo or video, however it is named', () => {
    const evil = ['<!DOCTYPE html><script>alert(1)</script>', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', '#!/bin/sh and then some more text', 'MZ an executable header and more bytes', '<?php system($_GET[0]); ?>'];
    for (const e of evil) expect([e.slice(0, 10), sniffMedia(text(e, 0, 64))]).toEqual([e.slice(0, 10), null]);
    expect(sniffMedia(new Uint8Array(4))).toBeNull(); // too short to tell
  });
});

describe('checkUpload', () => {
  const file = (a: Uint8Array, size = a.length) => ({ size, arrayBuffer: async () => a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) as ArrayBuffer });

  it('accepts a real photo and reports what it is', async () => {
    const r = await checkUpload(file(JPEG));
    expect(r.ok && r.media.ext).toBe('jpg');
  });

  it('refuses a script renamed to .jpg', async () => {
    const r = await checkUpload(file(text('<script>alert(1)</script>', 0, 64)));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.status).toBe(415);
  });

  it('refuses a photo over 10 MB and anything over 60 MB', async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(JPEG);
    const r = await checkUpload(file(big));
    expect(!r.ok && r.status).toBe(413);
    const huge = await checkUpload(file(JPEG, 61 * 1024 * 1024));
    expect(!huge.ok && huge.status).toBe(413);
  });
});

describe('safeMediaUrl', () => {
  it('allows our own assets, known image hosts, and honest data links', () => {
    expect(safeMediaUrl('/assets/moments/latte-art.jpg')).toBe('/assets/moments/latte-art.jpg');
    expect(safeMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/a.jpg')).toBe('https://res.cloudinary.com/demo/image/upload/v1/a.jpg');
    expect(safeMediaUrl(`data:image/jpeg;base64,${b64(JPEG)}`)).toContain('data:image/jpeg');
  });

  it('refuses scripts, other hosts, climbing paths and protocol tricks', () => {
    const bad = [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'http://res.cloudinary.com/a.jpg',
      'https://evil.example/pixel.gif',
      'https://res.cloudinary.com.evil.example/a.jpg',
      'https://user:pw@res.cloudinary.com/a.jpg',
      '//evil.example/a.jpg',
      '/assets/../../etc/passwd',
      '/assets//evil.example/a.jpg',
      '/api/staff/users',
      '',
    ];
    for (const u of bad) expect([u, safeMediaUrl(u)]).toEqual([u, null]);
    expect(safeMediaUrl(42)).toBeNull();
  });

  it('refuses a data link whose bytes are not what its label says', () => {
    expect(safeMediaUrl(`data:image/png;base64,${b64(JPEG)}`)).toBeNull(); // says PNG, is a JPEG
    expect(safeMediaUrl(`data:image/jpeg;base64,${b64(text('<script>x</script>', 0, 64))}`)).toBeNull();
  });
});
