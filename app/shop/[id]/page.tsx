import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BREW_METHODS } from '@/components/brewns/brewGuide';
import { Eyebrow } from '@/components/site/InfoBits';
import { ProductCard } from '@/components/site/ProductCard';
import { SitePage } from '@/components/site/SitePage';
import { CATALOG, catalogItem, money } from '@/lib/catalog';
import { dietBadges } from '@/lib/diet';
import { fromPrice, groupOf, related, title } from '@/lib/products';
import { imageFor } from '@/lib/server/productImage';
import { GiftCardArt } from '@/components/site/GiftCardArt';
import { SITE_URL } from '@/lib/site';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return CATALOG.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = catalogItem((await params).id);
  if (!p) return {};
  return publicPageMetadata(`${title(p.name)} · brewns`, (p.desc || `${title(p.name)} from brewns coffee house, Lahore.`).slice(0, 160), `/shop/${p.id}`);
}

/** Where a roast sits from light to dark, read from the bag's own details. */
function roastLevel(details: readonly (readonly [string, string])[] = []) {
  const roast = details.find(([k]) => k === 'ROAST')?.[1] || '';
  if (/light-medium/i.test(roast)) return 2;
  if (/light/i.test(roast)) return 1;
  if (/medium-dark/i.test(roast)) return 4;
  if (/dark/i.test(roast)) return 5;
  if (/medium/i.test(roast)) return 3;
  return 0;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = catalogItem((await params).id);
  if (!p) notFound();
  const group = groupOf(p);
  const img = imageFor(p);
  const photo = !p.cutout && !!img;
  const badges = dietBadges(p.id);
  const varies = p.options.some((o) => o.choices.some((c) => c[1] !== 0));
  const isBeans = p.cat === 'beans';
  const roast = isBeans ? roastLevel(p.details) : 0;
  const v60 = BREW_METHODS[0];
  const more = related(p);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title(p.name),
    description: p.desc,
    image: img ? `${SITE_URL}${img}` : undefined,
    brand: { '@type': 'Brand', name: 'brewns' },
    offers: { '@type': 'Offer', priceCurrency: 'PKR', price: fromPrice(p), availability: 'https://schema.org/InStock', url: `${SITE_URL}/shop/${p.id}` },
  };

  return (
    <SitePage current="shop" width={1240}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <article className="ip">
        <section className="pd">
          <div className={`pd-media${photo ? ' photo' : ''}`}>
            {img ? <Image src={img} alt={p.alt || title(p.name)} width={900} height={900} loading="eager" /> : p.gift ? <GiftCardArt amount={p.price} size="large" /> : <span className="pc-none">{p.name[0]}</span>}
          </div>
          <div className="pd-info">
            <nav className="pd-crumbs" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/shop#${group.key}`}>{group.label}</Link>
            </nav>
            {p.tag ? <Eyebrow>{p.tag}</Eyebrow> : null}
            <h1 className="pd-h1">{title(p.name)}</h1>
            <p className="pd-price">
              {varies ? <small>FROM</small> : null}
              {money(fromPrice(p))}
            </p>
            {p.meta ? <p className="ip-meta">{p.meta}</p> : null}
            {p.notes?.length ? (
              <div className="ip-notes">
                {p.notes.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            ) : null}
            {p.desc ? <p className="pd-desc">{p.desc}</p> : null}
            {badges.length ? (
              <div className="pd-badges">
                {badges.map((b) => (
                  <span key={b.text} className={b.kind === 'allergen' ? 'allergen' : undefined}>
                    {b.kind === 'allergen' ? `CONTAINS ${b.text}` : b.text}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="ip-btns">
              <Link href={`/#shop/${p.id}`} className="ip-btn">
                {p.gift ? 'Choose an amount →' : 'Choose & add to bag →'}
              </Link>
              {isBeans ? (
                <Link href="/subscribe" className="ip-btn ghost">
                  Subscribe & save 10%
                </Link>
              ) : null}
            </div>

            {p.options.filter((o) => o.key !== 'plan').length ? (
              <div className="pd-opts">
                {p.options
                  .filter((o) => o.key !== 'plan')
                  .map((o) => (
                    <div key={o.key} className="pd-opt">
                      <p>{o.label}</p>
                      <ul>
                        {o.choices.map(([label, add]) => (
                          <li key={label}>
                            {label}
                            {add ? <small>+{money(add)}</small> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : null}

            {roast ? (
              <div className="pd-roast" aria-label={`Roast level ${roast} of 5`}>
                <p className="ip-meta">ROAST LEVEL</p>
                <div className="pd-roast-bar">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= roast ? 'on' : undefined} />
                  ))}
                </div>
                <p className="pd-roast-labels">
                  <span>LIGHT</span>
                  <span>MEDIUM</span>
                  <span>DARK</span>
                </p>
              </div>
            ) : null}

            {p.details?.length ? (
              <dl className="pd-dl">
                {p.details.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {p.care ? <p className="pd-care">{p.care}</p> : null}
          </div>
        </section>

        {isBeans ? (
          <section className="ip-split" aria-label="Brew it at home">
            <div className="ip-head">
              <Eyebrow>Brew it at home</Eyebrow>
              <h2 className="ip-h2">A V60 to start.</h2>
              <p className="ip-lede">
                {v60.dosePerCup} g of coffee to about {v60.dosePerCup * v60.ratios[1]} g of water a cup, ground like coarse sand. Bloom with a splash, then pour slowly in circles. The brew timer calls every pour for you.
              </p>
              <div className="ip-btns">
                <Link href="/brew-timer" className="ip-btn">
                  Open the brew timer →
                </Link>
              </div>
            </div>
            <div className="ip-head">
              <Eyebrow>Every method</Eyebrow>
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
            </div>
          </section>
        ) : null}

        {more.length ? (
          <section className="ip-sec" aria-labelledby="more">
            <div className="shop-group-head">
              <h2 id="more" className="ip-h2">
                Goes well with
              </h2>
              <Link href={`/shop#${group.key}`} className="ip-back">
                All {group.label.toLowerCase()} →
              </Link>
            </div>
            <div className="pc-grid">
              {more.map((x) => (
                <ProductCard key={x.id} p={x} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </SitePage>
  );
}
