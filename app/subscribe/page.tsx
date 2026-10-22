import Image from 'next/image';
import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { basePrice, catalogItem, defaultSel, money, unitPrice } from '@/lib/catalog';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Subscribe & Save · brewns Coffee Beans',
  'Fresh brewns beans every two or four weeks, roasted in Lahore, with 10% off every bag. Slow Roast house blend or Ethiopia Yirgacheffe.',
  '/subscribe',
);

const STEPS = [
  ['01', 'Pick your beans', 'Slow Roast for milk drinks and everyday espresso, Yirgacheffe for filter and something brighter.'],
  ['02', 'Pick a size & grind', '250 g, 500 g or 1 kg, whole bean or ground for espresso, filter or French press.'],
  ['03', 'Pick a cadence', 'Every two weeks or every four. Ten percent comes off the price of every bag.'],
];

const FAQ = [
  ['How much do I save?', 'Ten percent off the bag price on every delivery, worked out at checkout. The saving shows on your receipt.'],
  ['How fresh are the beans?', 'We roast in small batches every week in Lahore, so your bag ships within days of roasting. Beans are best within four weeks of the roast date printed on the back.'],
  ['Which cadence should I choose?', 'A 250 g bag makes about 16 cups. One cup a day suits 250 g every two weeks; two coffee drinkers usually want 500 g every two weeks or 1 kg every four.'],
  ['Can I collect instead of delivery?', 'Yes. Choose pickup at checkout and collect from MM Alam Road, DHA Phase 5 or Johar Town.'],
  ['How do I change or stop it?', 'Message us at hello@brewns.coffee or call +92 42 1234 5678, 07:00 to 21:00, and we’ll change, pause or stop it.'],
];

const SIZE_ROWS: [string, number][] = [
  ['250 G', 0],
  ['500 G', 1],
  ['1 KG', 2],
];

export default function SubscribePage() {
  const beans = ['slow-roast', 'single-origin'].map((id) => catalogItem(id)).filter((p) => p !== undefined);
  return (
    <SitePage current="subscribe" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Subscribe &amp; save</Eyebrow>
          <div className="ip-hero-row">
            <div className="ip-head">
              <Headline as="h1" main="Coffee on" script="your schedule." />
              <p className="ip-lede">Fresh beans every two or four weeks, roasted in Lahore the week they ship, with ten percent off every bag. Collect at a counter or have it delivered.</p>
              <div className="ip-chips">
                <span className="ip-chip"><i aria-hidden="true" />10% off every bag</span>
                <span className="ip-chip"><i aria-hidden="true" />Every 2 or 4 weeks</span>
                <span className="ip-chip"><i aria-hidden="true" />Roasted weekly</span>
              </div>
            </div>
            <Image className="ip-hero-img" src="/assets/menu/bag-slow-roast.webp" alt="A brewns Slow Roast bag" width={520} height={640} loading="eager" />
          </div>
        </header>

        <section className="ip-sec" aria-labelledby="plans">
          <div className="ip-head">
            <Eyebrow>Choose your beans</Eyebrow>
            <h2 id="plans" className="ip-h2">
              Two bags,<span className="ip-script">your call.</span>
            </h2>
          </div>
          <ul className="ip-grid">
            {beans.map((p) => {
              const price = basePrice(p, defaultSel(p));
              return (
                <li key={p.id} className="ip-plan">
                  <Image src={`/assets/${p.photo}`} alt={p.alt ?? p.name} width={400} height={500} loading="lazy" />
                  <span className="ip-n">{p.tag}</span>
                  <h3>{p.name}</h3>
                  <p className="ip-meta">{p.meta}</p>
                  <div className="ip-notes">
                    {p.notes?.map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  <p className="ip-price">
                    <b>{money(unitPrice(p, { ...defaultSel(p), plan: 1 }))}</b>
                    <s>{money(price)}</s>
                    <small>250 G · PER DELIVERY</small>
                  </p>
                  <Link href={`/#shop/${p.id}`} className="ip-btn">
                    Subscribe →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ip-sec" aria-labelledby="how">
          <div className="ip-head">
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how" className="ip-h2">
              Three picks,<span className="ip-script">then forget it.</span>
            </h2>
          </div>
          <ol className="ip-grid">
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="ip-card">
                <span className="ip-n">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ip-sec" aria-labelledby="prices">
          <div className="ip-head">
            <Eyebrow>Every size</Eyebrow>
            <h2 id="prices" className="ip-h2">
              The bigger the bag,<span className="ip-script">the better the deal.</span>
            </h2>
          </div>
          <div className="ip-scroll">
            <table className="ip-table">
              <thead>
                <tr>
                  <th scope="col">Beans</th>
                  <th scope="col">Size</th>
                  <th scope="col">One-time</th>
                  <th scope="col">Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {beans.flatMap((p) =>
                  SIZE_ROWS.map(([label, size]) => {
                    const price = basePrice(p, { ...defaultSel(p), size });
                    return (
                      <tr key={`${p.id}-${label}`}>
                        <td>{p.name}</td>
                        <td>{label}</td>
                        <td>{money(price)}</td>
                        <td>{money(unitPrice(p, { ...defaultSel(p), size, plan: 1 }))}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ip-sec" aria-labelledby="questions">
          <div className="ip-head">
            <Eyebrow>Common questions</Eyebrow>
            <h2 id="questions" className="ip-h2">Asked &amp; answered</h2>
          </div>
          <div className="ip-faq">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <CtaBand title="Never run out" script="of good coffee." body="Open Slow Roast in the shop, choose every two or four weeks under Purchase, and add it to your bag." href="/#shop/slow-roast" label="Start with Slow Roast" />
      </article>
    </SitePage>
  );
}
