import { describe, expect, test } from 'bun:test';
import { hasDevanagari, toUrduScript } from '@/lib/devanagari';

describe('toUrduScript', () => {
  test('leaves Urdu and English alone', () => {
    expect(toUrduScript('آپ کی برانچ کہاں ہے؟')).toBe('آپ کی برانچ کہاں ہے؟');
    expect(toUrduScript('Book a table')).toBe('Book a table');
  });

  test('turns a Hindi-script caption into Urdu letters', () => {
    expect(toUrduScript('आपकी कौन-कौन सी ब्रांच है?')).toBe('آپکی کون-کون سی برانچ ہے؟');
  });

  test('aspirates, nasals and word-final vowels', () => {
    expect(toUrduScript('मुझे चार लोगों की टेबल चाहिए')).toBe('مجھے چار لوگوں کی ٹیبل چاہئے');
    expect(toUrduScript('मैं कल शाम सात बजे आऊंगा')).toBe('میں کل شام سات بجے آؤنگا');
  });

  test('nukta letters become the Urdu sounds', () => {
    expect(toUrduScript('ज़रूर, ख़ास')).toBe('زرور، خاس');
  });

  test('knows Devanagari when it sees it', () => {
    expect(hasDevanagari('मेनू')).toBe(true);
    expect(hasDevanagari('مینو')).toBe(false);
  });
});
