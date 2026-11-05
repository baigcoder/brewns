/* What an error report may carry out of the server. An order's tracking key rides in the URL (`?k=`) and is that
   order's password, and a visitor's address is personal data: neither belongs in Sentry. */

type Scrubbable = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: Record<string, unknown>; data?: unknown };
  user?: unknown;
  tags?: Record<string, unknown>;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

const dropQuery = (v: unknown) => (typeof v === 'string' ? v.replace(/[?#].*$/, '') : v);

export function scrubEvent<T extends Scrubbable>(event: T): T {
  if (event.request) {
    event.request.url = dropQuery(event.request.url) as string | undefined;
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) for (const h of Object.keys(event.request.headers)) if (/^(cookie|authorization|x-forwarded-for|x-real-ip|x-vercel-forwarded-for)$/i.test(h)) delete event.request.headers[h];
  }
  delete event.user; // the visitor's address and city
  if (event.tags) {
    delete event.tags.user;
    if (typeof event.tags.url === 'string') event.tags.url = dropQuery(event.tags.url);
  }
  for (const b of event.breadcrumbs || []) if (b.data) for (const k of ['url', 'to', 'from']) if (typeof b.data[k] === 'string') b.data[k] = dropQuery(b.data[k]);
  return event;
}
