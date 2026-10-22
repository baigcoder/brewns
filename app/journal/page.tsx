import Image from 'next/image';
import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { POSTS, postDate } from '@/lib/journal';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'The Journal · brewns',
  'Notes from the brewns bar: brew guides, the numbers behind our espresso, and how order-ahead gets your cup ready on time.',
  '/journal',
);

export default function JournalPage() {
  return (
    <SitePage current="journal" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>The journal</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Notes from" script="behind the bar." />
            <p className="ip-lede">Brew guides, the numbers behind the cup, and the odd story from the counter. Short reads, written by the people who make your coffee.</p>
          </div>
        </header>

        <section className="ip-posts" aria-label="Articles">
          {POSTS.map((p, i) => (
            <Link key={p.slug} href={`/journal/${p.slug}`} className={`ip-post${i === 0 ? ' lead' : ''}`}>
              <span className="ip-post-img">
                <Image src={p.image} alt={p.imageAlt} width={300} height={360} loading={i === 0 ? 'eager' : 'lazy'} />
              </span>
              <span className="ip-post-body">
                <span className="ip-meta">
                  <b>{p.kicker}</b> · {postDate(p.date)} · {p.minutes} min
                </span>
                {i === 0 ? <h2>{p.title}</h2> : <h3>{p.title}</h3>}
                <p>{p.excerpt}</p>
                <span className="ip-meta">Read →</span>
              </span>
            </Link>
          ))}
        </section>

        <CtaBand title="Brew it" script="at home." body="Pick a method and a number of cups. The brew timer works out the dose and calls every pour." href="/brew-timer" label="Open the brew timer" />
      </article>
    </SitePage>
  );
}
