import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { catalogItem } from '@/lib/catalog';
import { GiftCardArt } from '@/components/site/GiftCardArt';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Gift Cards · brewns',
  'A brewns gift card: good at all three counters in Lahore, sent instantly by email, and it never expires.',
  '/gift-cards',
);

export default function GiftCardsPage() {
  const card = catalogItem('gift-card');
  const amounts = card?.options.find((o) => o.key === 'amount')?.choices.map(([label]) => label) ?? [];
  return (
    <SitePage current="gift-cards" width={1100}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Gift cards</Eyebrow>
          <div className="ip-hero-row">
            <div className="ip-head">
              <Headline as="h1" main="Good coffee" script="for someone else’s day." />
              <p className="ip-lede">{card?.desc}</p>
              <div className="ip-chips">
                {amounts.map((a) => (
                  <span key={a} className="ip-chip">
                    <i aria-hidden="true" />
                    {a}
                  </span>
                ))}
              </div>
              <div className="ip-btns">
                <Link href="/#shop/gift-card" className="ip-btn">
                  Send a gift card →
                </Link>
              </div>
            </div>
            <span className="ip-hero-img gca-hero">
              <GiftCardArt size="large" />
            </span>
          </div>
        </header>

        <section className="ip-sec" aria-labelledby="how">
          <div className="ip-head">
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how" className="ip-h2">
              Simple as a coffee.
            </h2>
          </div>
          <ol className="ip-grid">
            <li className="ip-card">
              <span className="ip-n">01</span>
              <h3>Choose an amount</h3>
              <p>{amounts.join(', ')}, with a note from you on the front.</p>
            </li>
            <li className="ip-card">
              <span className="ip-n">02</span>
              <h3>It arrives by email</h3>
              <p>Instantly, to them or to you to pass on.</p>
            </li>
            <li className="ip-card">
              <span className="ip-n">03</span>
              <h3>Spend it anywhere</h3>
              <p>Coffee, food or beans, at any of our three counters.</p>
            </li>
            <li className="ip-card feature">
              <span className="ip-n">Always</span>
              <h3>Never expires</h3>
              <p>{card?.care}</p>
            </li>
          </ol>
        </section>

        <CtaBand title="For the coffee lover" script="who has everything." body="Pair it with a bag of Slow Roast and they’ll be set for weeks." href="/shop/slow-roast" label="See Slow Roast" />
      </article>
    </SitePage>
  );
}
