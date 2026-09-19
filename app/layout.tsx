import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VELDT COFFEE HOUSE — Specialty Roastery in San Francisco',
  description: 'Specialty coffee roastery in San Francisco. Small-batch seasonal roasts, dialed espresso, and zero-wait pickup across our three city locations.',
  keywords: ['Specialty Coffee', 'San Francisco Coffee', 'Coffee Roaster', 'Single Origin', 'Espresso Bar', 'Mission District'],
  authors: [{ name: 'Veldt Coffee Atelier' }],
  openGraph: {
    title: 'VELDT COFFEE HOUSE — Specialty Roastery in San Francisco',
    description: 'Specialty coffee roastery in San Francisco. Thoughtfully sourced, purposefully brewed.',
    type: 'website',
    locale: 'en_US',
    siteName: 'VELDT COFFEE HOUSE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VELDT COFFEE HOUSE',
    description: 'Specialty coffee roastery in San Francisco. Thoughtfully sourced, purposefully brewed.',
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
    name: 'VELDT COFFEE HOUSE',
    image: 'https://veldt.coffee/images/hero-preview.jpg',
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
