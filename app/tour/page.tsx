import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Site tour · brewns',
  'A short film of the brewns site, front to back, and every feature in one place: ordering ahead, 3D products, live tracking, the club, bookings and more.',
  '/tour',
);

/* Everything a visitor can do on the site, each with where it lives. */
const FEATURES: [string, string, string][] = [
  ['Order ahead', 'Pick from the menu, choose pickup or delivery, and see the fee and the time before you pay.', '/#menu'],
  ['Products in 3D', 'Turn a cup or a bag of beans around before you buy it. Every product has a photo and a 3D view.', '/#shop/latte'],
  ['Live order tracking', 'Follow your order from the bar to the counter, or the rider across Lahore.', '/account'],
  ['brewns Club', 'A stamp for every drink and the tenth one free, kept in your account.', '/#club'],
  ['Book a table', 'Reserve a table, or the whole shop, at any of the three counters.', '/reserve'],
  ['Bean subscription', 'Beans every two or four weeks, roasted that week, ten percent off each bag.', '/subscribe'],
  ['Gift cards', 'Digital cards that never expire, sent straight to someone’s phone.', '/gift-cards'],
  ['Call Sarah', 'Ring our voice concierge from the home page to order, book or ask a question, in English or Urdu.', '/'],
  ['Locations, live', 'Each counter with its hours, whether it is open right now, and directions.', '/locations'],
  ['Moments', 'Photos from the regulars, and a place to share your own.', '/#moments'],
  ['Brew timer', 'Pick a method and a number of cups; the timer works out the dose and calls every pour.', '/brew-timer'],
  ['Flavour matcher', 'Say what you like in a cup and get the coffee that fits.', '/flavor-wheel'],
];

export default function TourPage() {
  return (
    <SitePage current="tour" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Site tour · 1 min 45</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="See brewns," script="front to back." />
            <p className="ip-lede">A short film of the real site: the menu and 3D products, ordering ahead, live tracking, the club and Sarah on the phone. Then everything it does, one tap away.</p>
          </div>
        </header>

        <figure style={{ margin: 0 }}>
          <video
            controls
            playsInline
            preload="none"
            poster="/assets/film/brewns-tour-poster.webp"
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, background: '#0f0c0a' }}
            aria-label="The brewns tour, recorded on the real site"
          >
            <source src="/assets/film/brewns-tour-1080.webm" type="video/webm" media="(min-width: 900px)" />
            <source src="/assets/film/brewns-tour-1080.mp4" type="video/mp4" media="(min-width: 900px)" />
            <source src="/assets/film/brewns-tour-720.webm" type="video/webm" />
            <source src="/assets/film/brewns-tour-720.mp4" type="video/mp4" />
          </video>
        </figure>

        <section className="ip-sec" aria-label="Everything the site does">
          <Headline main="Everything" script="it does." />
          <ul className="ip-grid">
            {FEATURES.map(([title, body, href]) => (
              <li key={title}>
                <Link href={href} className="ip-card" style={{ height: '100%', textDecoration: 'none', color: 'inherit' }}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Ready for" script="a cup?" body="Order ahead for pickup or delivery and your cup is poured to meet you." href="/#menu" label="See the menu" />
      </article>
    </SitePage>
  );
}
