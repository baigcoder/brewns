import { describe, expect, test } from 'bun:test';
import { copyBuiltInPhotos } from '@/lib/server/menuPhotos';

describe('copying the built-in menu photos to Cloudinary', () => {
  const items = [
    { id: 'latte', name: 'LATTE', image: '/assets/menu/cup-latte.webp' },
    { id: 'mocha', name: 'MOCHA', image: '/assets/menu/cup-mocha.webp' },
    { id: 'espresso', name: 'ESPRESSO', image: '/assets/menu/cup-espresso.webp' },
    { id: 'no-pic', name: 'NO PIC', image: null },
  ];

  test("copies only items without the owner's photo, keeps going past a failure", async () => {
    const fetched: string[] = [];
    const out = await copyBuiltInPhotos(
      items,
      { latte: 'https://res.cloudinary.com/x/latte.jpg' },
      async (path) => {
        fetched.push(path);
        if (path.includes('mocha')) throw new Error('404');
        return Buffer.from(path);
      },
      async (id) => `https://res.cloudinary.com/x/brewns/menu/${id}.webp`,
      1,
    );
    expect(fetched).toEqual(['/assets/menu/cup-mocha.webp', '/assets/menu/cup-espresso.webp']);
    expect(out.added).toEqual({ espresso: 'https://res.cloudinary.com/x/brewns/menu/espresso.webp' });
    expect(out.copied).toBe(1);
    expect(out.skipped).toBe(2);
    expect(out.failed).toEqual(['MOCHA']);
  });
});
