import Image from 'next/image';
import Link from 'next/link';
import { BREW_METHODS } from '@/components/brewns/brewGuide';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import '@/components/site/shop.css';
import { CATALOG, money } from '@/lib/catalog';
import { title } from '@/lib/products';
import { imageFor } from '@/lib/server/productImage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Our Coffee · brewns Lahore',
  'The coffee behind every brewns cup: Slow Roast, a Colombian and Ethiopian house blend, and a washed Yirgacheffe, roasted every week in Lahore and pulled at 92°C for 27 seconds.',
  '/coffee',
);

const ROAST: Record<string, number> = { LIGHT: 1, 'LIGHT-MEDIUM': 2, MEDIUM: 3, 'MEDIUM-DARK': 4, DARK: 5 };

const STEPS = [
  ['01', 'Sourced', 'Washed coffees from Colombia and Ethiopia: clean, sweet and bright, picked for how they taste in a cup, with milk and without.'],
  ['02', 'Roasted', 'Small batches every week in Lahore. The roast date is printed on the back of every bag, so you always know how fresh it is.'],
  ['03', 'Rested', 'Fresh beans need a few days to settle. Espresso tastes best from about a week after roasting; filter within five weeks.'],
  ['04', 'Brewed', 'Every shot pulled at 92°C for 27 seconds, and milk steamed to 65°C so it stays sweet. The same at all three counters.'],
];

export default function CoffeePage() {
  const beans = CATALOG.filter((p) => p.cat === 'beans');
  return (
    <SitePage current="coffee" width={1180}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Our coffee</Eyebrow>
          <div className="ip-hero-row">
            <div className="ip-head">
              <Headline as="h1" main="Roasted every" script="single week." />
              <p className="ip-lede">Two coffees sit behind every cup at brewns: a house blend made to be sweet with milk and clean on its own, and a single origin for when you want something brighter. Both roasted in small batches in Lahore, both on the shelf to take home.</p>
              <div className="ip-btns">
                <Link href="/shop#beans" className="ip-btn">
                  Shop the beans →
                </Link>
                <Link href="/subscribe" className="ip-btn ghost">
                  Subscribe & save
                </Link>
              </div>
            </div>
            <Image className="ip-hero-img" src="/assets/menu/bag-slow-roast.webp" alt="A brewns Slow Roast bag" width={520} height={640} loading="eager" />
          </div>
        </header>

        <dl className="ip-stats" aria-label="The house recipe">
          <div><dt>Every shot</dt><dd>92°C</dd></div>
          <div><dt>Extraction</dt><dd>27 s</dd></div>
          <div><dt>Steamed milk</dt><dd>65°C</dd></div>
          <div><dt>Roasted</dt><dd>Weekly</dd></div>
          <div><dt>Door to cup</dt><dd>~4 min</dd></div>
        </dl>

        <section className="ip-sec" aria-labelledby="two">
          <div className="ip-head">
            <Eyebrow>The two coffees</Eyebrow>
            <h2 id="two" className="ip-h2">
              One for every day,<span className="ip-script">one for a slow morning.</span>
            </h2>
          </div>
          <div className="ip-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))' }}>
            {beans.map((p) => {
              const roastLabel = p.details?.find(([k]) => k === 'ROAST')?.[1] || '';
              const level = ROAST[roastLabel.toUpperCase()] || 0;
              const img = imageFor(p);
              return (
                <Link key={p.id} href={`/shop/${p.id}`} className="ip-card" style={{ gap: 16, textDecoration: 'none', color: 'inherit' }}>
                  <span className="pc-img" style={{ borderRadius: 16 }}>
                    {img ? <Image src={img} alt={p.alt || title(p.name)} width={520} height={520} loading="lazy" /> : null}
                  </span>
                  <span className="ip-n">{p.tag}</span>
                  <h3>{title(p.name)}</h3>
                  <div className="ip-notes">
                    {p.notes?.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  <p>{p.desc}</p>
                  <dl className="pd-dl">
                    {(p.details || []).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {level ? (
                    <div className="pd-roast" aria-label={`Roast level ${level} of 5`}>
                      <div className="pd-roast-bar">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <i key={n} className={n <= level ? 'on' : undefined} />
                        ))}
                      </div>
                      <p className="pd-roast-labels">
                        <span>LIGHT</span>
                        <span>MEDIUM</span>
                        <span>DARK</span>
                      </p>
                    </div>
                  ) : null}
                  <span className="ip-more">From {money(p.price)} · See the bag →</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="ip-sec" aria-labelledby="steps">
          <div className="ip-head">
            <Eyebrow>From green bean to your cup</Eyebrow>
            <h2 id="steps" className="ip-h2">
              Four steps,<span className="ip-script">no shortcuts.</span>
            </h2>
          </div>
          <ol className="ip-time">
            {STEPS.map(([n, t, d]) => (
              <li key={n}>
                <span className="when">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ip-split" aria-label="Brew it at home">
          <div className="ip-head">
            <Eyebrow>Brew it at home</Eyebrow>
            <h2 className="ip-h2">The numbers, worked out.</h2>
            <p className="ip-lede">Pick a method and how many cups; the brew timer weighs it out and calls every pour. Here’s where each one starts.</p>
            <div className="ip-btns">
              <Link href="/brew-timer" className="ip-btn">
                Open the brew timer →
              </Link>
              <Link href="/flavor-wheel" className="ip-btn ghost" style={{ color: '#100c0a', borderColor: 'rgb(16 12 10 / 0.25)' }}>
                Find your flavour
              </Link>
            </div>
          </div>
          <ul className="ip-grid ip-methods" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {BREW_METHODS.map((m) => (
              <li key={m.id} className="ip-card" style={{ background: '#fff', borderColor: 'rgb(16 12 10 / 0.1)', color: '#100c0a' }}>
                <h3>{title(m.name)}</h3>
                <p style={{ color: 'rgb(16 12 10 / 0.65)' }}>
                  1 : {m.ratios[1]} · {m.dosePerCup} g a cup
                </p>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Taste it" script="at the counter." body="Every brewns counter pulls the same shot. Come and try both coffees side by side." href="/locations" label="Find a counter" />
      </article>
    </SitePage>
  );
}
