import type { Metadata } from 'next';
import Link from 'next/link';
import { BrewTimer } from '@/components/brew/BrewTimer';
import '@/app/console.css';

export const metadata: Metadata = {
  title: 'Brew Timer & Ratio Calculator · brewns',
  description: 'Interactive pour-over stopwatch and ratio companion for V60, Chemex, AeroPress and French Press with step-by-step guidance.',
};

export default function BrewTimerPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a09', color: '#f5ede3', padding: '40px 20px 80px' }}>
      <header
        style={{
          maxWidth: '820px',
          margin: '0 auto 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #222',
          paddingBottom: '20px',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-space-mono)',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textDecoration: 'none',
            color: '#f5ede3',
          }}
        >
          brewns<span style={{ color: 'var(--cx-accent, #c99355)' }}>.</span>
        </Link>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
          <Link href="/#menu" style={{ color: '#aaa', textDecoration: 'none' }}>
            Menu
          </Link>
          <Link href="/reserve" style={{ color: '#aaa', textDecoration: 'none' }}>
            Reserve
          </Link>
          <Link href="/flavor-wheel" style={{ color: '#aaa', textDecoration: 'none' }}>
            Flavor Matcher
          </Link>
          <Link href="/account" style={{ color: '#aaa', textDecoration: 'none' }}>
            Account
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '820px', margin: '0 auto' }}>
        <BrewTimer />
      </main>
    </div>
  );
}
