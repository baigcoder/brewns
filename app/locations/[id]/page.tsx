import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { OpenNow } from '@/components/site/OpenNow';
import { SitePage } from '@/components/site/SitePage';
import { CAFE_PHONE, CAFES, cafeById, mapEmbedUrl, mapsUrl } from '@/lib/locations';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return CAFES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = cafeById((await params).id);
  if (!c) return {};
  return publicPageMetadata(`brewns ${c.name}, ${c.area}`, `brewns coffee house at ${c.name}, ${c.area}. Open every day 07:00–21:00. Directions, parking, Wi-Fi, order ahead and table bookings.`, `/locations/${c.id}`);
}

export default async function CafePage({ params }: { params: Promise<{ id: string }> }) {
  const c = cafeById((await params).id);
  if (!c) notFound();
  const others = CAFES.filter((x) => x.id !== c.id);
  return (
    <SitePage current="locations" width={1180}>
      <article className="ip">
        <header className="ip-hero">
          <Link href="/locations" className="ip-back">
            ← All counters
          </Link>
          <Eyebrow>{c.nickname}</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main={c.name} script={c.area} />
            <p className="ip-lede">{c.blurb}</p>
            <div className="ip-chips">
              <OpenNow />
              <span className="ip-chip">
                <i aria-hidden="true" />
                Kitchen & seating until 20:00
              </span>
            </div>
            <div className="ip-btns">
              <a href={mapsUrl(c)} target="_blank" rel="noopener noreferrer" className="ip-btn">
                Directions ↗
              </a>
              <Link href="/reserve" className="ip-btn ghost">
                Book a table
              </Link>
              <Link href="/#order" className="ip-btn ghost">
                Order ahead
              </Link>
            </div>
          </div>
        </header>

        <section className="ip-map" aria-label={`Map of brewns ${c.name}`}>
          <iframe title={`Map of brewns ${c.name}, ${c.area}`} src={mapEmbedUrl(c)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </section>

        <section className="ip-sec" aria-labelledby="here">
          <div className="ip-head">
            <Eyebrow>At this counter</Eyebrow>
            <h2 id="here" className="ip-h2">
              Good to know
            </h2>
          </div>
          <ul className="ip-grid">
            <li className="ip-card">
              <span className="ip-n">Hours</span>
              <h3>07:00 – 21:00</h3>
              <p>Every day. Seating and the kitchen until 20:00.</p>
            </li>
            {c.features.map((f) => (
              <li key={f} className="ip-card">
                <span className="ip-n">Here</span>
                <h3>{f}</h3>
              </li>
            ))}
            <li className="ip-card">
              <span className="ip-n">Call</span>
              <h3>
                <a href={`tel:${CAFE_PHONE.replace(/\s/g, '')}`} style={{ color: 'inherit' }}>
                  {CAFE_PHONE}
                </a>
              </h3>
              <p>Or ask Sarah, our concierge, from the call button on the site.</p>
            </li>
          </ul>
        </section>

        <section className="ip-sec" aria-labelledby="others">
          <div className="ip-head">
            <Eyebrow>Same cup, other rooms</Eyebrow>
            <h2 id="others" className="ip-h2">
              The other counters
            </h2>
          </div>
          <ul className="ip-grid">
            {others.map((o) => (
              <li key={o.id} className="ip-card">
                <span className="ip-n">{o.nickname}</span>
                <h3>{o.name}</h3>
                <p>{o.area}</p>
                <Link href={`/locations/${o.id}`} className="ip-more">
                  See this counter →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Skip the line" script="next time." body={`Order ahead for pickup at ${c.name} and your cup is poured to meet you.`} href="/#order" label="Order ahead" />
      </article>
    </SitePage>
  );
}
