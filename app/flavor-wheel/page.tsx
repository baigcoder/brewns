import type { Metadata } from 'next';
import Link from 'next/link';
import { FlavorMatcher } from '@/components/flavor/FlavorMatcher';
import '@/app/console.css';

export const metadata: Metadata = {
  title: 'Coffee Flavor Wheel & Bean Matcher · brewns',
  description: 'Interactive tasting notes flavor selector. Pick stone fruit, floral, caramel, or dark cocoa to find your ideal single-origin roast.',
};

export default function FlavorWheelPage() {
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
          <Link href="/#shop" style={{ color: '#aaa', textDecoration: 'none' }}>
            Shop
          </Link>
          <Link href="/reserve" style={{ color: '#aaa', textDecoration: 'none' }}>
            Reserve
          </Link>
          <Link href="/brew-timer" style={{ color: '#aaa', textDecoration: 'none' }}>
            Brew Timer
          </Link>
          <Link href="/account" style={{ color: '#aaa', textDecoration: 'none' }}>
            Account
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '820px', margin: '0 auto' }}>
        <FlavorMatcher />
      </main>
    </div>
  );
}
