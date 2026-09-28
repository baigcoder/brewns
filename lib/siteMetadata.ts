import type { Metadata } from 'next';
import { SITE_URL } from './site';

/** Build route-specific canonical and sharing metadata for public pages. */
export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      locale: 'en_PK',
      siteName: 'brewns',
      images: [{ url: `${SITE_URL}/opengraph-image.jpg`, alt: 'brewns coffee house in Lahore' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/opengraph-image.jpg`],
    },
  };
}
