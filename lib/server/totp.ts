/* Two-step sign-in codes: the six digits an authenticator app shows (RFC 6238,
   built on RFC 4226), plus one-time recovery codes for a lost phone. No library:
   it is an HMAC and some base32, and Node already has both.

   Nothing here touches storage; lib/server/twostep.ts keeps the secret (encrypted)
   and the used-code bookkeeping. */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 4226: the code for one counter value. */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}

export const counterAt = (t = Date.now()) => Math.floor(t / 1000 / STEP_SECONDS);

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The time-step a code belongs to, if it is right within `window` steps either
 * side of now (clocks drift), else null. Callers refuse a step they have
 * already accepted, so a code cannot be used twice.
 */
export function matchTotp(key: Buffer, code: string, t = Date.now(), window = 1): number | null {
  const given = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const now = counterAt(t);
  let hit: number | null = null;
  // Check every step (no early exit) so timing does not hint at which one matched.
  for (let c = now - window; c <= now + window; c++) if (same(hotp(key, c), given)) hit = c;
  return hit;
}

export const newSecret = () => randomBytes(20);

/** What the authenticator app scans (as a QR code) or is given by hand. */
export const otpauthUrl = (account: string, issuer: string, secret: Buffer) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

/** Spaces and dashes are for reading; ignore them and the case when comparing. */
export const normaliseRecovery = (code: string) => String(code).toLowerCase().replace(/[^a-z2-7]/g, '');
export const hashRecovery = (code: string) => createHash('sha256').update(normaliseRecovery(code)).digest('base64url');

/** Eight one-use codes like "k3f7-x2m7": shown once, kept only as hashes. */
export function newRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const c = base32Encode(randomBytes(5)).toLowerCase(); // 5 bytes = exactly 8 characters
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}
