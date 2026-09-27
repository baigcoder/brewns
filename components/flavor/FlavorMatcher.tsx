'use client';

import { useState } from 'react';
import Link from 'next/link';

type FlavorNote = {
  id: string;
  label: string;
  icon: string;
  category: string;
};

const FLAVOR_NOTES: FlavorNote[] = [
  { id: 'peach', label: 'Stone Fruit / Peach', icon: '🍑', category: 'Fruity' },
  { id: 'citrus', label: 'Citrus & Bergamot', icon: '🍋', category: 'Fruity' },
  { id: 'jasmine', label: 'Jasmine & Florals', icon: '🌸', category: 'Floral' },
  { id: 'caramel', label: 'Caramel & Toffee', icon: '🍮', category: 'Sweet' },
  { id: 'brown-sugar', label: 'Brown Sugar', icon: '🍯', category: 'Sweet' },
  { id: 'almond', label: 'Roasted Almond', icon: '🌰', category: 'Nutty' },
  { id: 'cocoa', label: 'Dark Cocoa', icon: '🍫', category: 'Rich' },
  { id: 'berry', label: 'Blackcurrant / Berry', icon: '🫐', category: 'Fruity' },
];

type CoffeeMatch = {
  id: string;
  name: string;
  tag: string;
  price: number;
  origin: string;
  process: string;
  altitude: string;
  roast: string;
  notes: string[];
  desc: string;
  matchingKeys: string[];
};

const BEANS_DATA: CoffeeMatch[] = [
  {
    id: 'single-origin',
    name: 'ETHIOPIA YIRGACHEFFE',
    tag: 'SINGLE ORIGIN',
    price: 4800,
    origin: 'Gedeo Zone, Yirgacheffe, Ethiopia',
    process: 'Washed, Sun-dried on Raised Beds',
    altitude: '1,950 – 2,200 MASL',
    roast: 'Light-Medium',
    notes: ['Peach', 'Jasmine', 'Citrus Bergamot', 'Earl Grey'],
    desc: 'An exceptional high-altitude heirloom variety. Delicate floral aroma, vibrant bergamot acidity, and a silky tea-like peach finish.',
    matchingKeys: ['peach', 'citrus', 'jasmine', 'berry'],
  },
  {
    id: 'slow-roast',
    name: 'BREWNS SLOW ROAST',
    tag: 'SIGNATURE HOUSE ROAST',
    price: 3800,
    origin: 'Cerrado Mineiro, Brazil & Huehuetenango, Guatemala',
    process: 'Pulped Natural & Washed Blend',
    altitude: '1,100 – 1,600 MASL',
    roast: 'Medium-Dark',
    notes: ['Caramel', 'Brown Sugar', 'Roasted Almond', 'Dark Cocoa'],
    desc: 'Our house espresso and filter anchor. Roasted slow past medium so natural sugars caramelize without harsh bitterness. Sweet in milk, rich on its own.',
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

  const handleAddToBag = (c: CoffeeMatch) => {
    try {
      const bag = JSON.parse(localStorage.getItem('brewns-bag') || '[]');
      bag.push({ id: c.id, qty: 1, sel: { size: 0, grind: 0 } });
      localStorage.setItem('brewns-bag', JSON.stringify(bag));
      setAdded(c.id);
      setTimeout(() => setAdded(null), 3000);
    } catch {}
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
          Find Your Ideal Coffee Profile
        </h1>
        <p style={{ color: 'var(--cx-muted, #8e8d88)', fontSize: '14px', marginTop: 6 }}>
          Select the flavors and aromas you enjoy. We match your palate with our small-batch roasted coffees.
        </p>
      </div>

      {/* Flavor Notes Picker */}
      <div style={{ marginBottom: 32 }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)', display: 'block', marginBottom: 10 }}>
          1. Choose Your Preferred Flavor Notes ({selectedNotes.length} Selected)
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
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Matches List */}
      <div>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)', display: 'block', marginBottom: 12 }}>
          2. Recommended Coffees Ranked For You
        </span>

        <div style={{ display: 'grid', gap: '18px' }}>
          {matches.map((c) => {
            const pct = Math.round((c.score / Math.max(1, selectedNotes.length)) * 100);
            return (
              <div
                key={c.id}
                style={{
                  background: '#191918',
                  border: '1px solid var(--cx-line-2, #262624)',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'grid',
                  gap: '14px',
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
                      Rs {c.price.toLocaleString()}
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
                      {pct}% Palate Match
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '14px', color: '#ccc', lineHeight: 1.5, margin: 0 }}>
                  {c.desc}
                </p>

                {/* Tasting Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {c.notes.map((note) => {
                    const matched = selectedNotes.some((n) => note.toLowerCase().includes(n));
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #262624' }}>
                  <div style={{ fontSize: '12px', color: 'var(--cx-muted, #8e8d88)' }}>
                    Roast: <b style={{ color: '#eee' }}>{c.roast}</b> · Process: <b style={{ color: '#eee' }}>{c.process}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="cx-btn primary"
                      onClick={() => handleAddToBag(c)}
                    >
                      {added === c.id ? '✓ Added to Bag' : '+ Add 250g to Bag'}
                    </button>
                    <Link href="/?bag=open" className="cx-btn" style={{ background: '#252524' }}>
                      View Bag →
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
