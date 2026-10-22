import Image from 'next/image';
import Link from 'next/link';
import { money, type Product } from '@/lib/catalog';
import { fromPrice, title } from '@/lib/products';
import { imageFor } from '@/lib/server/productImage';
import { GiftCardArt } from './GiftCardArt';
import './shop.css';

/** One product in a grid: picture, name, a line about it, and the price. */
export function ProductCard({ p }: { p: Product }) {
  const img = imageFor(p);
  // Cut-outs stand on the card; real photos fill it.
  const photo = !p.cutout && !!img;
  const from = fromPrice(p);
  const varies = p.options.some((o) => o.choices.some((c) => c[1] !== 0));
  return (
    <Link href={`/shop/${p.id}`} className="pc">
      {p.tag ? <span className="pc-tag">{p.tag}</span> : null}
      <span className={`pc-img${photo ? ' photo' : ''}`}>
        {img ? <Image src={img} alt={p.alt || title(p.name)} width={480} height={480} loading="lazy" /> : p.gift ? <GiftCardArt amount={p.price} /> : <span className="pc-none">{p.name[0]}</span>}
      </span>
      <span className="pc-body">
        <span className="pc-meta">{p.meta || p.notes?.slice(0, 2).join(' · ') || ''}</span>
        <h3>{title(p.name)}</h3>
        <span className="pc-price">
          {varies ? 'From ' : ''}
          {money(from)}
        </span>
      </span>
    </Link>
  );
}
