import { describe, expect, it } from 'bun:test';
import { base32Decode, base32Encode, counterAt, hashRecovery, hotp, matchTotp, newRecoveryCodes, newSecret, normaliseRecovery, otpauthUrl } from '@/lib/server/totp';

// RFC 4226 appendix D: secret "12345678901234567890", counters 0 to 9.
const RFC_KEY = Buffer.from('12345678901234567890');
const RFC_CODES = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

describe('hotp (RFC 4226)', () => {
  it('matches the published test vectors', () => {
    RFC_CODES.forEach((code, counter) => expect([counter, hotp(RFC_KEY, counter)]).toEqual([counter, code]));
  });
});

describe('matchTotp (RFC 6238)', () => {
  // RFC 6238 appendix B uses 8 digits; the last six are what a 6-digit app shows. At T=59s the counter is 1.
  it('accepts the code for the current 30-second step', () => {
    expect(counterAt(59_000)).toBe(1);
    expect(matchTotp(RFC_KEY, '287082', 59_000)).toBe(1);
  });

  it('allows one step of clock drift either way, and no more', () => {
    expect(matchTotp(RFC_KEY, '755224', 59_000)).toBe(0); // the step just gone
    expect(matchTotp(RFC_KEY, '359152', 59_000)).toBe(2); // the step about to come
    expect(matchTotp(RFC_KEY, '969429', 59_000)).toBeNull(); // three steps away
  });

  it('refuses anything that is not six digits, and a wrong code', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '28708 2x', '000000']) expect([bad, matchTotp(RFC_KEY, bad, 59_000)]).toEqual([bad, null]);
  });

  it('ignores spaces typed into the code', () => {
    expect(matchTotp(RFC_KEY, '287 082', 59_000)).toBe(1);
  });
});

describe('base32', () => {
  it('round-trips, and reads what authenticator apps show (spaces, lower case)', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) expect(base32Decode(base32Encode(Buffer.from(text))).toString()).toBe(text);
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI'); // RFC 4648 test vector
    expect(base32Decode('mzxw 6ytb oi').toString()).toBe('foobar');
  });
});

describe('enrolment helpers', () => {
  it('builds the otpauth link an app scans', () => {
    const url = otpauthUrl('sara@brewns.test', 'brewns', Buffer.from('foobar'));
    expect(url).toBe('otpauth://totp/brewns:sara%40brewns.test?secret=MZXW6YTBOI&issuer=brewns&algorithm=SHA1&digits=6&period=30');
  });

  it('makes a 160-bit secret each time', () => {
    expect(newSecret()).toHaveLength(20);
    expect(newSecret().equals(newSecret())).toBe(false);
  });

  it('makes eight distinct recovery codes that read like "k3f7-x2m7" and hash regardless of formatting', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(/^[a-z2-7]{4}-[a-z2-7]{4}$/.test(c)).toBe(true);
    expect(normaliseRecovery(' K3F7 x2m7 ')).toBe('k3f7x2m7');
    expect(hashRecovery('K3F7-X2M7')).toBe(hashRecovery('k3f7x2m7'));
  });
});
