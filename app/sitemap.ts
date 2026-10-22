import type { MetadataRoute } from 'next';
import { POSTS } from '@/lib/journal';
import { CATALOG } from '@/lib/catalog';
import { CAFES } from '@/lib/locations';
import { FILM } from '@/lib/howItWorks';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/locations`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/subscribe`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/journal`, changeFrequency: 'weekly', priority: 0.7 },
    ...POSTS.map((p) => ({ url: `${SITE_URL}/journal/${p.slug}`, lastModified: p.date, changeFrequency: 'yearly' as const, priority: 0.5 })),
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'weekly', priority: 0.9 },
    ...CATALOG.map((p) => ({ url: `${SITE_URL}/shop/${p.id}`, changeFrequency: 'monthly' as const, priority: p.cat === 'beans' ? 0.8 : 0.6 })),
    { url: `${SITE_URL}/coffee`, changeFrequency: 'monthly', priority: 0.8 },
    ...CAFES.map((c) => ({ url: `${SITE_URL}/locations/${c.id}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${SITE_URL}/gift-cards`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/careers`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/delivery`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/refunds`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/reserve`, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${SITE_URL}${FILM.path}`,
      changeFrequency: 'monthly',
      priority: 0.7,
      videos: [{ title: FILM.title, description: FILM.description, thumbnail_loc: `${SITE_URL}${FILM.poster}`, content_loc: `${SITE_URL}${FILM.sources.large.mp4}`, duration: FILM.seconds, publication_date: FILM.uploaded }],
    },
    { url: `${SITE_URL}/brew-timer`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/flavor-wheel`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
