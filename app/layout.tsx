import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: 'brewns — Specialty Coffee House in Lahore',
  description: 'Specialty coffee house in Lahore. Carefully sourced beans, thoughtfully brewed. Order ahead and skip the line at MM Alam Road, DHA Phase 5 and Johar Town, open daily 07:00–21:00.',
  keywords: ['Specialty Coffee', 'Lahore Coffee', 'Coffee Roaster', 'Single Origin', 'Espresso Bar', 'MM Alam Road', 'DHA Lahore', 'Johar Town'],
  authors: [{ name: 'brewns coffee house' }],
  openGraph: {
    title: 'brewns — Specialty Coffee House in Lahore',
    description: 'Specialty coffee house in Lahore. Carefully sourced beans, thoughtfully brewed.',
    type: 'website',
    locale: 'en_PK',
    siteName: 'brewns',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'brewns — Specialty Coffee House',
    description: 'Specialty coffee house in Lahore. Carefully sourced beans, thoughtfully brewed.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#070707',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    telephone: '+92-42-1234-5678',
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
    ],
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
