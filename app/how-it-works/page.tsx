import type { Metadata } from 'next';
import Link from 'next/link';
import { FilmPlayer } from '@/components/site/FilmPlayer';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { CHAPTERS, CUES, FILM, clockTime } from '@/lib/howItWorks';
import { SITE_URL } from '@/lib/site';
import { publicPageMetadata } from '@/lib/siteMetadata';

const base = publicPageMetadata('How brewns works · Order ahead in Lahore', FILM.description, FILM.path);

export const metadata: Metadata = {
  ...base,
  openGraph: {
    ...base.openGraph,
    images: [{ url: `${SITE_URL}${FILM.poster}`, width: 1280, height: 720, alt: 'The brewns site, open on the home page' }],
    videos: [{ url: `${SITE_URL}${FILM.sources.large.mp4}`, type: 'video/mp4', width: 1920, height: 1080 }],
  },
  twitter: { ...base.twitter, images: [`${SITE_URL}${FILM.poster}`] },
};

/* What search engines read: the film, and each chapter as a moment they can link to. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: FILM.title,
  description: FILM.description,
  thumbnailUrl: [`${SITE_URL}${FILM.poster}`],
  uploadDate: `${FILM.uploaded}T09:00:00+05:00`,
  duration: `PT${Math.floor(FILM.seconds / 60)}M${FILM.seconds % 60}S`,
  contentUrl: `${SITE_URL}${FILM.sources.large.mp4}`,
  inLanguage: 'en',
  publisher: { '@type': 'Organization', name: 'brewns', url: SITE_URL },
  transcript: CUES.map(([, , text]) => text).join(' '),
  hasPart: CHAPTERS.map((c, i) => ({
    '@type': 'Clip',
    name: c.title,
    startOffset: c.at,
    endOffset: CHAPTERS[i + 1]?.at ?? FILM.seconds,
    url: `${SITE_URL}${FILM.path}?t=${c.at}`,
  })),
};

export default function HowItWorksPage() {
  return (
    <SitePage width={1120}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>How brewns works</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Order ahead." script="in about a minute." />
            <p className="ip-lede">
              It’s 7 am in Lahore and you need coffee, like right now. Watch how it works: open the menu, make the cup your own, pay ahead and walk past the line. Or just call, and Sarah books your table.
            </p>
          </div>
          <FilmPlayer />
        </header>

        <section className="ip-sec" aria-labelledby="transcript">
          <div className="ip-head">
            <Eyebrow>Read it instead</Eyebrow>
            <h2 id="transcript" className="ip-h2">
              The film,<span className="ip-script">in words.</span>
            </h2>
          </div>
          <details className="fp-script">
            <summary>Show the transcript</summary>
            <ol>
              {CUES.map(([from, , text]) => (
                <li key={from}>
                  <time dateTime={`PT${Math.floor(from)}S`}>{clockTime(from)}</time>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </details>
          <p className="ip-lede">
            Between 0:39 and 0:43 the film shows a call with Sarah, our AI concierge: “Table for two tonight, around 8?” “Done. MM Alam Road, 8:00 pm. See you then!” She takes bookings in English or Urdu. Prefer to tap?{' '}
            <Link href="/reserve">Book a table online</Link>.
          </p>
        </section>

        <CtaBand title="Skip the line" script="next time." body="Order ahead for pickup or delivery and your cup is poured to meet you." href="/#order" label="Order ahead" />
      </article>
    </SitePage>
  );
}
