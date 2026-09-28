'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { catalogItem, defaultSel, money } from '@/lib/catalog';
import './flavor.css';

type FlavorNote = {
  id: string;
  label: string;
  category: keyof typeof TONE;
};

/** One quiet colour per flavour family, in place of emoji. */
const TONE = { Fruity: '#e0895a', Floral: '#d48fb0', Sweet: '#d9a45a', Nutty: '#b58a64', Rich: '#8a5a3c' };

const FLAVOR_NOTES: FlavorNote[] = [
  { id: 'peach', label: 'Stone Fruit / Peach', category: 'Fruity' },
  { id: 'citrus', label: 'Citrus & Bergamot', category: 'Fruity' },
  { id: 'jasmine', label: 'Jasmine & Florals', category: 'Floral' },
  { id: 'caramel', label: 'Caramel & Toffee', category: 'Sweet' },
  { id: 'brown-sugar', label: 'Brown Sugar', category: 'Sweet' },
  { id: 'almond', label: 'Roasted Almond', category: 'Nutty' },
  { id: 'cocoa', label: 'Dark Cocoa', category: 'Rich' },
  { id: 'berry', label: 'Blackcurrant / Berry', category: 'Fruity' },
];

type CoffeeMatch = {
  id: string;
  name: string;
  tag: string;
  origin: string;
  process: string;
  altitude: string;
  roast: string;
  notes: [string, string | null][];
  desc: string;
  matchingKeys: string[];
};

const BEANS_DATA: CoffeeMatch[] = [
  {
    id: 'single-origin',
    name: 'ETHIOPIA YIRGACHEFFE',
    tag: 'SINGLE ORIGIN',
    origin: 'Gedeo Zone, Yirgacheffe, Ethiopia',
    process: 'Washed, Sun-dried on Raised Beds',
    altitude: '1,950 – 2,200 MASL',
    roast: 'Light-Medium',
    notes: [['Peach', 'peach'], ['Jasmine', 'jasmine'], ['Citrus Bergamot', 'citrus'], ['Earl Grey', null]],
    desc: 'An exceptional high-altitude heirloom variety. Delicate floral aroma, vibrant bergamot acidity, and a silky tea-like peach finish.',
    matchingKeys: ['peach', 'citrus', 'jasmine', 'berry'],
  },
  {
    id: 'slow-roast',
    name: 'BREWNS SLOW ROAST',
    tag: 'SIGNATURE HOUSE ROAST',
    origin: 'Huila, Colombia & Sidama, Ethiopia',
    process: 'Washed',
    altitude: '1,600 – 2,000 MASL',
    roast: 'Medium',
    notes: [['Caramel', 'caramel'], ['Brown Sugar', 'brown-sugar'], ['Roasted Almond', 'almond'], ['Dark Cocoa', 'cocoa']],
    desc: 'Our house espresso and filter anchor. Roasted slow, a shade past medium, so the sugars caramelise without turning bitter. Sweet in milk, rich on its own.',
    matchingKeys: ['caramel', 'brown-sugar', 'almond', 'cocoa'],
  },
];

export function FlavorMatcher() {
  const [selectedNotes, setSelectedNotes] = useState<string[]>(['peach', 'jasmine']);
  const [added, setAdded] = useState<string | null>(null);

  const toggleNote = (id: string) => {
    setSelectedNotes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Rank coffees based on match score
  const matches = BEANS_DATA.map((coffee) => {
    const score = coffee.matchingKeys.filter((k) => selectedNotes.includes(k)).length;
    return { ...coffee, score };
  }).sort((a, b) => b.score - a.score);

  const [bagCount, setBagCount] = useState(0);
  const readBag = (): { key: string; id: string; sel: Record<string, number>; qty: number; message: string }[] => {
    try {
      return JSON.parse(localStorage.getItem('brewns-bag') || '[]');
    } catch {
      return [];
    }
  };
  useEffect(() => {
    // Mirrors what's already in the bag on the main site.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBagCount(readBag().reduce((n, i) => n + (i.qty || 0), 0));
  }, []);

  /** Adds a 250 g whole-bean bag, exactly as the shop's own + ADD would. */
  const handleAddToBag = (c: CoffeeMatch) => {
    const p = catalogItem(c.id);
    if (!p) return;
    const sel = defaultSel(p);
    const key = `${p.id}|${JSON.stringify(sel)}|`;
    const bag = readBag();
    const hit = bag.find((i) => i.key === key);
    if (hit) hit.qty = Math.min(20, hit.qty + 1);
    else bag.push({ key, id: p.id, sel, qty: 1, message: '' });
    try {
      localStorage.setItem('brewns-bag', JSON.stringify(bag));
    } catch {}
    setBagCount(bag.reduce((n, i) => n + (i.qty || 0), 0));
    setAdded(c.id);
    setTimeout(() => setAdded((a) => (a === c.id ? null : a)), 2500);
  };

  const families = (Object.keys(TONE) as (keyof typeof TONE)[]).map((f) => ({ family: f, notes: FLAVOR_NOTES.filter((n) => n.category === f) }));
  const none = !selectedNotes.length;

  return (
    <div className="fm">
      <div className="fm-head">
        <p className="fm-eyebrow">{'//'} Bean matcher</p>
        <h1 className="fm-title">Find your coffee</h1>
        <p className="fm-sub">Tap the flavours you like. We rank our beans for you, roasted weekly in small batches in Lahore.</p>
      </div>

      <div className="fm-grid">
        <aside className="fm-taste" aria-label="Flavours you like">
          <div className="fm-taste-top">
            <p className="fm-k">Your taste{selectedNotes.length ? ` · ${selectedNotes.length}` : ''}</p>
            {!none && (
              <button type="button" className="fm-clear" onClick={() => setSelectedNotes([])}>
                Clear
              </button>
            )}
          </div>
          {families.map(({ family, notes }) => (
            <div key={family} className="fm-family">
              <p className="fm-family-name">
                <i style={{ background: TONE[family] }} aria-hidden="true" />
                {family}
              </p>
              <div className="fm-chips">
                {notes.map((n) => {
                  const active = selectedNotes.includes(n.id);
                  return (
                    <button key={n.id} type="button" aria-pressed={active} className={`fm-chip${active ? ' on' : ''}`} style={{ '--tone': TONE[n.category] } as React.CSSProperties} onClick={() => toggleNote(n.id)}>
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <section className="fm-results" aria-label="Our coffees, best match first" aria-live="polite">
          {matches.map((c, rank) => {
            const p = catalogItem(c.id);
            const pct = Math.round((c.score / Math.max(1, selectedNotes.length)) * 100);
            const best = !none && rank === 0 && c.score > 0;
            return (
              <article key={c.id} className={`fm-card${best ? ' best' : ''}`}>
                <div className="fm-photo">{p?.photo && <Image src={`/assets/${p.photo}`} alt={p.alt || c.name} width={220} height={260} />}</div>
                <div className="fm-body">
                  <div className="fm-card-top">
                    <div>
                      <p className="fm-tag">
                        {best && <span className="fm-best">Best match</span>}
                        {c.tag}
                      </p>
                      <h2 className="fm-name">{c.name}</h2>
                      <p className="fm-origin">{c.origin}</p>
                    </div>
                    <p className="fm-price">{money(p?.price ?? 0)}</p>
                  </div>

                  <div className="fm-match">
                    <div className="fm-bar" aria-hidden="true">
                      <i style={{ width: `${none ? 0 : pct}%` }} />
                    </div>
                    <span>{none ? 'Pick a flavour to see the match' : `${pct}% match · ${c.score} of ${selectedNotes.length} flavours`}</span>
                  </div>

                  <p className="fm-desc">{c.desc}</p>

                  <div className="fm-notes">
                    {c.notes.map(([note, noteKey]) => {
                      const matched = !!noteKey && selectedNotes.includes(noteKey);
                      return (
                        <span key={note} className={`fm-note${matched ? ' on' : ''}`}>
                          {matched ? '✓ ' : ''}
                          {note}
                        </span>
                      );
                    })}
                  </div>

                  <dl className="fm-specs">
                    <div>
                      <dt>Roast</dt>
                      <dd>{c.roast}</dd>
                    </div>
                    <div>
                      <dt>Process</dt>
                      <dd>{c.process}</dd>
                    </div>
                    <div>
                      <dt>Altitude</dt>
                      <dd>{c.altitude}</dd>
                    </div>
                  </dl>

                  <div className="fm-actions">
                    <button type="button" className={`fm-add${added === c.id ? ' ok' : ''}`} onClick={() => handleAddToBag(c)}>
                      {added === c.id ? '✓ Added to bag' : `Add 250 g · ${money(p?.price ?? 0)}`}
                    </button>
                    <Link href="/?bag=open" className="fm-view">
                      View bag{bagCount ? ` (${bagCount})` : ''} →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
