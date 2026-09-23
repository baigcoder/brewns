import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'brewns — Specialty Coffee House in San Francisco',
  description: 'Specialty coffee house in San Francisco. Carefully sourced beans, thoughtfully brewed. Order ahead and skip the line — three locations, open daily 07:00–21:00.',
  keywords: ['Specialty Coffee', 'San Francisco Coffee', 'Coffee Roaster', 'Single Origin', 'Espresso Bar', 'Mission District'],
  authors: [{ name: 'brewns coffee house' }],
  openGraph: {
    title: 'brewns — Specialty Coffee House in San Francisco',
    description: 'Specialty coffee house in San Francisco. Carefully sourced beans, thoughtfully brewed.',
    type: 'website',
    locale: 'en_US',
    siteName: 'brewns',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'brewns — Specialty Coffee House',
    description: 'Specialty coffee house in San Francisco. Carefully sourced beans, thoughtfully brewed.',
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CoffeeShop',
    name: 'brewns coffee house',
    telephone: '+1-415-529-8812',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '139 Coffee Street',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94110',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.7651,
      longitude: -122.4194,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '07:00',
        closes: '21:00',
      },
    ],
    servesCuisine: 'Specialty Coffee',
    priceRange: '$$',
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
