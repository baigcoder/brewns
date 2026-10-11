/* Two-step sign-in for staff accounts: after the password, a six-digit code from
   an authenticator app (or one of eight one-use recovery codes if the phone is
   lost). Optional per person; owners and managers are nudged to turn it on.

   The secret is stored sealed (encrypted with the server's secret), the recovery
   codes only as hashes, and a code that has been used cannot be used again. */

import { saveUser, seal, unseal, type User } from './auth';
import { base32Decode, base32Encode, hashRecovery, matchTotp, newRecoveryCodes, newSecret, otpauthUrl } from './totp';
import { fail } from './http';
import { qrSvg } from '@/lib/qr';

export const ISSUER = 'brewns';

const secretOf = async (u: User) => {
  if (!u.totp) return null;
  const text = await unseal(u.totp.enc);
  return text ? base32Decode(text) : null;
};

/** Step one: a fresh secret, not yet switched on. Returns what the person needs to add it to their app. */
export async function beginEnrol(user: User) {
  if (user.totp?.on) fail(409, 'Two-step sign-in is already on. Turn it off first to set it up again.');
  const secret = newSecret();
  const next: User = { ...user, totp: { enc: await seal(base32Encode(secret)), on: false, since: 0, last: 0, recovery: [] } };
  await saveUser(next, user);
  const uri = otpauthUrl(user.email, ISSUER, secret);
  return { key: base32Encode(secret).replace(/(.{4})/g, '$1 ').trim(), uri, qr: qrSvg(uri) };
}

/** Step two: the first code from their app proves it works. Switches it on and gives the recovery codes, once. */
export async function confirmEnrol(user: User, code: string) {
  if (!user.totp || user.totp.on) fail(409, 'Start setting up two-step sign-in first.');
  const key = await secretOf(user);
  const step = key ? matchTotp(key, code) : null;
  if (step === null) fail(400, "That code isn't right. Check your app (the code changes every 30 seconds) and try again.");
  const recovery = newRecoveryCodes();
  const next: User = { ...user, totp: { ...user.totp!, on: true, since: Date.now(), last: step!, recovery: recovery.map(hashRecovery) } };
  await saveUser(next, user);
  return { user: next, recovery };
}

/**
 * Checks a code typed at sign-in or when changing the setting: an app code (not one already used)
 * or an unused recovery code, which is then spent. Updates and saves `user` in place.
 */
export async function checkSecondFactor(user: User, input: string): Promise<'app' | 'recovery' | null> {
  const t = user.totp;
  if (!t?.on) return null;
  const typed = String(input || '').trim();
  const key = await secretOf(user);
  const step = key ? matchTotp(key, typed) : null;
  if (step !== null && step > t.last) {
    user.totp = { ...t, last: step };
    await saveUser(user);
    return 'app';
  }
  if (step === null) {
    const h = hashRecovery(typed);
    if (typed.replace(/[^a-zA-Z2-7]/g, '').length === 8 && t.recovery.includes(h)) {
      user.totp = { ...t, recovery: t.recovery.filter((x) => x !== h) };
      await saveUser(user);
      return 'recovery';
    }
  }
  return null;
}

/** Fresh recovery codes (the old ones stop working). */
export async function newRecovery(user: User) {
  if (!user.totp?.on) fail(409, 'Turn on two-step sign-in first.');
  const recovery = newRecoveryCodes();
  const next: User = { ...user, totp: { ...user.totp!, recovery: recovery.map(hashRecovery) } };
  await saveUser(next, user);
  return { user: next, recovery };
}

/** Turns it off (or abandons a half-finished set-up). */
export async function switchOff(user: User) {
  const next: User = { ...user, totp: null };
  await saveUser(next, user);
  return next;
}
