'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogItem, defaultSel, money } from '@/lib/catalog';

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

  return (
    <div
      style={{
        background: '#141413',
        border: '1px solid var(--cx-line-2, #262624)',
        borderRadius: '20px',
        padding: '36px',
        maxWidth: '860px',
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <p className="cx-eyebrow" style={{ color: 'var(--cx-accent, #c99355)', marginBottom: 4 }}>
          <b>{'//'}</b> Specialty Bean Matcher
        </p>
        <h1 style={{ fontSize: '28px', color: '#f5ede3', fontWeight: 600, margin: 0 }}>
          Find your coffee
        </h1>
        <p style={{ color: 'var(--cx-muted, #8e8d88)', fontSize: '14px', marginTop: 6 }}>
          Pick the flavours you like and we&apos;ll rank our beans for you, roasted weekly in small batches in Lahore.
        </p>
      </div>

      {/* Flavor Notes Picker */}
      <div style={{ marginBottom: 32 }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)', display: 'block', marginBottom: 10 }}>
          1. Pick the flavours you enjoy{selectedNotes.length ? ` · ${selectedNotes.length} picked` : ''}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {FLAVOR_NOTES.map((n) => {
            const active = selectedNotes.includes(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => toggleNote(n.id)}
                style={{
                  padding: '9px 15px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                  background: active ? 'rgba(201, 147, 85, 0.16)' : '#191918',
                  color: active ? '#f5ede3' : 'var(--cx-muted, #8e8d88)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[n.category], flexShrink: 0 }} />
                <span>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Matches List */}
      <div>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)', display: 'block', marginBottom: 12 }}>
          2. Our coffees, best match first
        </span>

        <div style={{ display: 'grid', gap: '18px' }}>
          {matches.map((c) => {
            const pct = Math.round((c.score / Math.max(1, selectedNotes.length)) * 100);
            const none = !selectedNotes.length;
            return (
              <div
                key={c.id}
                style={{
                  background: '#191918',
                  border: '1px solid var(--cx-line-2, #262624)',
                  borderRadius: '14px',
                  padding: 'clamp(16px, 4vw, 24px)',
                  display: 'grid',
                  gap: '14px',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--cx-accent, #c99355)', fontWeight: 700, letterSpacing: '0.08em' }}>
                      {c.tag}
                    </span>
                    <h3 style={{ fontSize: '20px', color: '#f5ede3', margin: '2px 0 0', fontWeight: 700 }}>
                      {c.name}
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--cx-muted, #8e8d88)', marginTop: 2 }}>
                      {c.origin} · {c.altitude}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5ede3', fontFamily: 'var(--font-space-mono)' }}>
                      {money(catalogItem(c.id)?.price ?? 0)}
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: pct > 50 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(201, 147, 85, 0.15)',
                        color: pct > 50 ? '#4ade80' : 'var(--cx-accent, #c99355)',
                        fontWeight: 600,
                      }}
                    >
                      {none ? 'Pick a note' : `${pct}% match`}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '14px', color: '#ccc', lineHeight: 1.5, margin: 0 }}>
                  {c.desc}
                </p>

                {/* Tasting Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {c.notes.map(([note, noteKey]) => {
                    const matched = !!noteKey && selectedNotes.includes(noteKey);
                    return (
                      <span
                        key={note}
                        style={{
                          fontSize: '12px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: matched ? 'rgba(201, 147, 85, 0.2)' : '#242422',
                          color: matched ? 'var(--cx-accent, #c99355)' : '#aaa',
                          border: matched ? '1px solid var(--cx-accent, #c99355)' : '1px solid transparent',
                          fontWeight: matched ? 600 : 400,
                        }}
                      >
                        {matched ? '✓ ' : ''}{note}
                      </span>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #262624' }}>
                  <div style={{ fontSize: '12px', color: 'var(--cx-muted, #8e8d88)' }}>
                    Roast: <b style={{ color: '#eee' }}>{c.roast}</b> · Process: <b style={{ color: '#eee' }}>{c.process}</b>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      className="cx-btn primary"
                      onClick={() => handleAddToBag(c)}
                    >
                      {added === c.id ? '✓ Added' : '+ Add 250 g bag'}
                    </button>
                    <Link href="/?bag=open" className="cx-btn" style={{ background: '#252524' }}>
                      View bag{bagCount ? ` (${bagCount})` : ''} →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
