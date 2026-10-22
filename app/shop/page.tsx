import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { ProductCard } from '@/components/site/ProductCard';
import { SitePage } from '@/components/site/SitePage';
import { GROUPS, productsIn } from '@/lib/products';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Shop · brewns Coffee, Beans & Gifts',
  'Everything brewns makes: coffee beans roasted weekly in Lahore, the café’s coffee, coolers, bakery and kitchen, merch and gift cards.',
  '/shop',
);

export default function ShopPage() {
  const groups = GROUPS.map((g) => ({ g, items: productsIn(g) })).filter((x) => x.items.length);
  return (
    <SitePage current="shop" width={1240}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>The shop</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Everything" script="we make." />
            <p className="ip-lede">Beans roasted every week, the café’s menu to order ahead, and things to take home. Tap anything for the full story.</p>
          </div>
        </header>
        <div>
          <nav className="shop-tabs" aria-label="Shop sections">
            {groups.map(({ g }) => (
              <a key={g.key} href={`#${g.key}`}>
                {g.label}
              </a>
            ))}
          </nav>
          <div style={{ display: 'grid', gap: 'clamp(3rem, 7vw, 5rem)' }}>
            {groups.map(({ g, items }) => (
              <section key={g.key} id={g.key} className="shop-group" aria-labelledby={`h-${g.key}`}>
                <div className="shop-group-head">
                  <h2 id={`h-${g.key}`} className="ip-h2">
                    {g.label}
                  </h2>
                  <p>{g.blurb}</p>
                </div>
                <div className="pc-grid">
                  {items.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <CtaBand title="Never run out" script="of good coffee." body="Any bag of beans can come every two or four weeks, with ten percent off every delivery." href="/subscribe" label="Subscribe & save" />
      </article>
    </SitePage>
  );
}
