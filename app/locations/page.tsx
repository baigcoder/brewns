import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { OpenNow } from '@/components/site/OpenNow';
import { SitePage } from '@/components/site/SitePage';
import { CAFE_PHONE, CAFES, mapEmbedUrl, mapsUrl } from '@/lib/locations';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Locations · brewns Lahore',
  'Visit brewns at MM Alam Road (Gulberg III), CCA DHA Phase 5 and Main Boulevard Johar Town. Open daily 07:00–21:00, with order-ahead pickup at every counter.',
  '/locations',
);

export default function LocationsPage() {
  return (
    <SitePage current="locations" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Visit us</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Three counters." script="one recipe." />
            <p className="ip-lede">Every brewns pulls the same shot at the same 92°C, so pick the counter that’s closest. Open every day, 07:00 to 21:00, with order-ahead pickup at all three.</p>
            <div className="ip-chips">
              <OpenNow />
              <span className="ip-chip">
                <i aria-hidden="true" />
                Kitchen & seating until 20:00
              </span>
              <span className="ip-chip">
                <i aria-hidden="true" />
                {CAFE_PHONE}
              </span>
            </div>
          </div>
        </header>

        <section className="ip-sec" aria-label="Our counters">
          {CAFES.map((c, i) => (
            <div key={c.id} id={c.id} className="ip-loc">
              <span className="ip-loc-n" aria-hidden="true">
                0{i + 1}
              </span>
              <div className="ip-loc-main">
                <span className="ip-n">{c.nickname}</span>
                <h2 className="ip-h2">{c.name}</h2>
                <p className="ip-meta">{c.area}</p>
                <p className="ip-lede">{c.blurb}</p>
                <div className="ip-btns">
                  <a href={mapsUrl(c)} target="_blank" rel="noopener noreferrer" className="ip-btn" aria-label={`Directions to ${c.name}, ${c.area}`}>
                    Directions ↗
                  </a>
                  <Link href={`/locations/${c.id}`} className="ip-btn ghost">
                    This counter →
                  </Link>
                </div>
                <ul aria-label={`At ${c.name}`}>
                  {c.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="ip-loc-map">
                <iframe title={`Map of brewns ${c.name}`} src={mapEmbedUrl(c)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </div>
          ))}
        </section>

        <section className="ip-sec" aria-labelledby="hours">
          <div className="ip-head">
            <Eyebrow>Good to know</Eyebrow>
            <h2 id="hours" className="ip-h2">
              Hours &amp;<span className="ip-script">house rules.</span>
            </h2>
          </div>
          <ul className="ip-grid">
            <li className="ip-card">
              <span className="ip-n">Every day</span>
              <h3>07:00 – 21:00</h3>
              <p>Same hours at all three counters, weekends and holidays included.</p>
            </li>
            <li className="ip-card">
              <span className="ip-n">Before 9</span>
              <h3>Double stamps</h3>
              <p>Club members earn two stamps a drink on early mornings.</p>
            </li>
            <li className="ip-card">
              <span className="ip-n">Order ahead</span>
              <h3>Skip the line</h3>
              <p>Pick a counter and a time; the cup is poured to meet you.</p>
            </li>
          </ul>
        </section>

        <CtaBand title="Order ahead," script="skip the line." body="Choose a counter and a pickup time, or have it delivered. Same menu as the café, kitchen included." href="/#order" label="Start an order" />
      </article>
    </SitePage>
  );
}
