'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@/components/console/console.css';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('0300 ');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/owner-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Owner registration failed.');
      } else {
        router.push('/dashboard/overview');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0C0B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#FAF7F2',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '440px',
          maxWidth: '100%',
          background: '#181412',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '22px',
              letterSpacing: '0.18em',
              color: '#FAF7F2',
            }}
          >
            BREWNS
          </Link>
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#A8A095',
              letterSpacing: '0.08em',
            }}
          >
            INITIAL OWNER REGISTRATION
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#F87171',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: '11px', color: '#A8A095', marginBottom: '6px' }}>
              FULL NAME
            </label>
            <input
              type="text"
              className="co-input"
              placeholder="e.g. Hassan Baig"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: '11px', color: '#A8A095', marginBottom: '6px' }}>
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              className="co-input"
              placeholder="owner@brewns.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: '11px', color: '#A8A095', marginBottom: '6px' }}>
              MOBILE PHONE
            </label>
            <input
              type="tel"
              className="co-input"
              placeholder="0300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: '11px', color: '#A8A095', marginBottom: '6px' }}>
              PASSWORD
            </label>
            <input
              type="password"
              className="co-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-co btn-co-primary"
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Creating Owner Account...' : 'Set Up Brewns Owner Account'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#A8A095' }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: '#D98A2C', textDecoration: 'none', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
