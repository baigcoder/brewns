import { describe, expect, test } from 'bun:test';
import { speechChunks } from '@/lib/voiceChunks';

describe('speechChunks', () => {
  test('empty text has nothing to say', () => {
    expect(speechChunks('   ')).toEqual([]);
  });

  test('a single short sentence stays whole', () => {
    expect(speechChunks('Hi, this is Sarah at brewns.')).toEqual(['Hi, this is Sarah at brewns.']);
  });

  test('keeps the first chunk short so it can play straight away', () => {
    const chunks = speechChunks('Sure, I can book that for you. A table for four at MM Alam Road, tomorrow at 7 pm. Shall I confirm it under your name?');
    expect(chunks[0]).toBe('Sure, I can book that for you.');
    expect(chunks.length).toBe(2);
    expect(chunks.join(' ')).toBe('Sure, I can book that for you. A table for four at MM Alam Road, tomorrow at 7 pm. Shall I confirm it under your name?');
  });

  test('merges a very short opener into the next sentence', () => {
    expect(speechChunks('Yes. We open at seven every morning, at all three counters.')).toEqual(['Yes. We open at seven every morning, at all three counters.']);
  });

  test('a decimal point is not the end of a sentence', () => {
    expect(speechChunks('A 1.5 kg bag of Slow Roast is on the shelf today. Want one?')[0]).toBe('A 1.5 kg bag of Slow Roast is on the shelf today.');
  });

  test('"Rs." before a price does not end the sentence', () => {
    expect(speechChunks('Your order of two iced lattes comes to Rs. 2,300 with delivery. Shall I place it?')[0]).toBe('Your order of two iced lattes comes to Rs. 2,300 with delivery.');
  });

  test('splits Urdu sentences on ۔ and ؟', () => {
    const chunks = speechChunks('جی بالکل، میں آپ کے لیے ٹیبل بک کر سکتی ہوں۔ آپ کتنے لوگ ہوں گے اور کس وقت آنا چاہیں گے؟');
    expect(chunks.length).toBe(2);
    expect(chunks[0].endsWith('۔')).toBe(true);
  });

  test('cuts a run-on sentence at a comma, never mid-word', () => {
    const long = `${'We have smash burgers, wood-fired pizza, pasta, paratha rolls, '.repeat(5)}and coffee.`;
    const chunks = speechChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(220);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(long.replace(/\s+/g, ' ').trim());
  });
});
