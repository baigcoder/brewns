import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { preload } from 'react-dom';
import './globals.css';
import './segments.css';
import { SITE_URL } from '@/lib/site';
import { FAQ } from '@/lib/faq';
import RegisterSW from '@/components/site/RegisterSW';
import { InstallPrompt } from '@/components/site/InstallPrompt';

// Self-hosted: a build must never depend on fetching Google Fonts (it failed intermittently on Vercel).
const geist = localFont({
  src: './fonts/geist-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-geist',
  display: 'swap',
});

const onest = localFont({
  src: './fonts/onest-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-onest',
  display: 'swap',
});

// "Space Mono" and "Allura" are declared in globals.css under those exact names (the engine, the receipts and the 3D
// labels ask for them by name), so they are not loaded here.

// Urdu in the concierge's captions and chat, in the Nastaliq script people read it in.
const urdu = localFont({
  src: [
    { path: './fonts/noto-nastaliq-urdu-arabic-400-normal.woff2', weight: '400' },
    { path: './fonts/noto-nastaliq-urdu-arabic-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-urdu',
  preload: false, // only the call and chat use it
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'brewns — Specialty Coffee House in Lahore',
  description: 'Specialty coffee house in Lahore. Carefully sourced beans, thoughtfully brewed. Order ahead and skip the line at MM Alam Road, DHA Phase 5 and Johar Town, open daily 07:00–21:00.',
  keywords: ['Specialty Coffee', 'Lahore Coffee', 'Coffee Roaster', 'Single Origin', 'Espresso Bar', 'MM Alam Road', 'DHA Lahore', 'Johar Town'],
  authors: [{ name: 'brewns coffee house' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#100c0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Space Mono carries the small labels at the top of the page, so fetch it early.
  preload('/assets/fonts/SpaceMono-Regular.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  // The three shops as one business, so search and maps can show each branch.
  const hours = {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '07:00',
    closes: '21:00',
  };
  const shop = (id: string, name: string, streetAddress: string, extra = {}) => ({
    '@type': 'CafeOrCoffeeShop',
    '@id': `${SITE_URL}/#${id}`,
    name: `brewns ${name}`,
    parentOrganization: { '@id': `${SITE_URL}/#brewns` },
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image.jpg`,
    address: { '@type': 'PostalAddress', streetAddress, addressLocality: 'Lahore', addressRegion: 'Punjab', addressCountry: 'PK' },
    openingHoursSpecification: [hours],
    servesCuisine: ['Specialty coffee', 'Bakery', 'Burgers', 'Pizza', 'Pasta'],
    priceRange: 'Rs 450 – Rs 6,500',
    currenciesAccepted: 'PKR',
    paymentAccepted: 'Cash, Credit Card, JazzCash, Easypaisa',
    hasMenu: `${SITE_URL}/#menu`,
    ...extra,
  });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE_URL}/#brewns`, name: 'brewns coffee house', url: SITE_URL, logo: `${SITE_URL}/icon.svg`, email: 'hello@brewns.coffee' },
      shop('mm-alam', 'MM Alam Road', 'MM Alam Road, Gulberg III', {
        address: { '@type': 'PostalAddress', streetAddress: 'MM Alam Road, Gulberg III', addressLocality: 'Lahore', addressRegion: 'Punjab', postalCode: '54660', addressCountry: 'PK' },
        geo: { '@type': 'GeoCoordinates', latitude: 31.5126, longitude: 74.3513 },
      }),
      shop('dha', 'DHA Phase 5', 'CCA, DHA Phase 5'),
      shop('johar-town', 'Johar Town', 'Main Boulevard, Johar Town'),
      // The same questions as the "Good to know" section, word for word.
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  return (
    <html lang="en" className={`${geist.variable} ${onest.variable} ${urdu.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
