import Link from 'next/link';
import { ContactForm } from '@/components/site/ContactForm';
import { Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { CAFE_EMAIL, CAFE_PHONE, CAFES, mapsUrl } from '@/lib/locations';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Contact · brewns Lahore',
  'Get in touch with brewns: questions, feedback, orders, events and catering, or wholesale beans. Call, email or write to us.',
  '/contact',
);

export default function ContactPage() {
  return (
    <SitePage current="contact" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Get in touch</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Say hello." script="we read everything." />
            <p className="ip-lede">A question about an order, feedback on a visit, an event that needs a coffee bar, or beans for your office. Write to us and someone from the counter will reply.</p>
          </div>
        </header>

        <section className="ip-contact" aria-label="Contact details and message">
          <div className="ip-sec" style={{ alignContent: 'start' }}>
            <ul className="ip-grid" style={{ gridTemplateColumns: '1fr' }}>
              <li className="ip-card feature">
                <span className="ip-n">Call</span>
                <h3>
                  <a href={`tel:${CAFE_PHONE.replace(/\s/g, '')}`} style={{ color: 'inherit' }}>
                    {CAFE_PHONE}
                  </a>
                </h3>
                <p>Every day, 07:00 to 21:00.</p>
              </li>
              <li className="ip-card">
                <span className="ip-n">Email</span>
                <h3>
                  <a href={`mailto:${CAFE_EMAIL}`} style={{ color: 'inherit', textTransform: 'none' }}>
                    {CAFE_EMAIL}
                  </a>
                </h3>
                <p>We aim to reply the same day.</p>
              </li>
              <li className="ip-card">
                <span className="ip-n">Visit</span>
                <h3>Three counters</h3>
                <p>
                  {CAFES.map((c, i) => (
                    <span key={c.id}>
                      {i ? ' · ' : ''}
                      <a href={mapsUrl(c)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                        {c.name}
                      </a>
                    </span>
                  ))}
                </p>
                <Link href="/locations" className="ip-more">
                  All locations →
                </Link>
              </li>
            </ul>
          </div>
          <ContactForm />
        </section>
      </article>
    </SitePage>
  );
}
