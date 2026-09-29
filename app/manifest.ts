import type { MetadataRoute } from 'next';

/* Makes the site installable: staff can pin the console to a tablet's home
   screen and regulars can pin their orders. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'brewns coffee house',
    short_name: 'brewns',
    description: 'Specialty coffee house in Lahore. Order ahead and track your order live.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#070707',
    theme_color: '#070707',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Kitchen screen', url: '/dashboard/kitchen' },
      { name: 'My account', url: '/account' },
    ],
  };
}
