import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CoffeeShop',
    name: 'brewns coffee house',
    telephone: '+92-42-1234-5678',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'MM Alam Road, Gulberg III',
      addressLocality: 'Lahore',
      addressRegion: 'Punjab',
      postalCode: '54660',
      addressCountry: 'PK',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 31.5126,
      longitude: 74.3513,
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
    currenciesAccepted: 'PKR',
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
