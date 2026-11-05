/** Where the site lives, for canonical links, the sitemap, share previews and every link we send (invites, tracking). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://brewns-chi.vercel.app').replace(/\/$/, '');
/** The address as printed on receipts: "BREWNS-CHI.VERCEL.APP". */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').toUpperCase();
