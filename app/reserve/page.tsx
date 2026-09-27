import type { Metadata } from 'next';
import Link from 'next/link';
import { ReservationForm } from '@/components/reserve/ReservationForm';
import '@/app/console.css';

export const metadata: Metadata = {
  title: 'Table Reservations · brewns Lahore',
  description: 'Book a table or coffee bar seat at brewns MM Alam Road, DHA Phase 5, or Johar Town.',
};

export default function ReservePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a09', color: '#f5ede3', padding: '40px 20px 80px' }}>
      <header
        style={{
          maxWidth: '900px',
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
          <Link href="/brew-timer" style={{ color: '#aaa', textDecoration: 'none' }}>
            Brew Timer
          </Link>
          <Link href="/flavor-wheel" style={{ color: '#aaa', textDecoration: 'none' }}>
            Flavor Matcher
          </Link>
          <Link href="/account" style={{ color: '#aaa', textDecoration: 'none' }}>
            Account
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto' }}>
        <ReservationForm />
      </main>
    </div>
  );
}
