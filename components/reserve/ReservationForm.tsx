'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LOC_TITLES, RESERVE_SLOTS as TIME_SLOTS, slotMinutes } from '@/lib/catalog';
import { pkDay, pkMinutes } from '@/lib/orderFlow';
import { playSuccessChime } from '@/lib/audio-alerts';

/** A slot is bookable today only if it's at least 30 minutes away (Lahore time). */
const openSlot = (date: string, slot: string, now = Date.now()) => date !== pkDay(now) || (slotMinutes(slot) ?? 0) >= pkMinutes(now) + 30;

const SEATING_AREAS = [
  { id: 'indoor', label: 'Indoor Lounge', desc: 'Warm ambient lighting, velvet sofas, La Marzocco soundtrack' },
  { id: 'terrace', label: 'Outdoor Terrace', desc: 'Breezy greenery, marble tables, natural light' },
  { id: 'bar', label: 'Espresso Bar', desc: 'High stools directly at the brew bar with our baristas' },
] as const;

export function ReservationForm() {
  // Today in Lahore; after the last seating, tomorrow.
  const [todayStr] = useState(() => pkDay(Date.now()));
  const [loc, setLoc] = useState(0);
  const [date, setDate] = useState(() => (TIME_SLOTS.some((t) => openSlot(todayStr, t)) ? todayStr : pkDay(Date.now() + 86400000)));
  const [time, setTime] = useState(() => TIME_SLOTS.find((t) => openSlot(date, t) && (slotMinutes(t) ?? 0) >= 17 * 60) || TIME_SLOTS.find((t) => openSlot(date, t)) || TIME_SLOTS[0]);
  const pickDate = (d: string) => {
    setDate(d);
    if (!openSlot(d, time)) setTime(TIME_SLOTS.find((t) => openSlot(d, t)) || time);
  };
  const [guests, setGuests] = useState(2);
  const [area, setArea] = useState<'indoor' | 'terrace' | 'bar'>('indoor');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          loc,
          date,
          time,
          guests,
          area,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm booking.');

      playSuccessChime();
      setConfirmed(data.reservation);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <div
        style={{
          background: '#141413',
          border: '1px solid var(--cx-line-2, #262624)',
          borderRadius: '16px',
          padding: '36px 32px',
          maxWidth: '580px',
          margin: '0 auto',
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
        <p className="cx-eyebrow" style={{ color: 'var(--cx-accent, #c99355)' }}>
          <b>{'//'}</b> Table Confirmed
        </p>
        <h2 style={{ fontSize: '28px', color: '#f5ede3', margin: '8px 0 16px', fontWeight: 600 }}>
          We look forward to hosting you, {confirmed.name.split(' ')[0]}!
        </h2>
        <p style={{ color: 'var(--cx-muted, #8e8d88)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
          Your reservation is booked at <b>{LOC_TITLES[confirmed.loc]}</b>. A confirmation reference has been created.
        </p>

        <div
          style={{
            background: 'rgba(201, 147, 85, 0.08)',
            border: '1px dashed var(--cx-accent, #c99355)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '28px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            textAlign: 'left',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)' }}>Booking Code</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f5ede3', fontFamily: 'var(--font-space-mono)' }}>{confirmed.code}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)' }}>Guests</span>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#f5ede3' }}>{confirmed.guests} People ({confirmed.area})</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)' }}>Date</span>
            <div style={{ fontSize: '15px', color: '#f5ede3' }}>{confirmed.date}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cx-muted, #8e8d88)' }}>Time</span>
            <div style={{ fontSize: '15px', color: '#f5ede3' }}>{confirmed.time}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            className="cx-btn primary big"
            onClick={() => setConfirmed(null)}
          >
            Book Another Table
          </button>
          <Link href="/" className="cx-btn big" style={{ background: '#222' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#141413',
        border: '1px solid var(--cx-line-2, #262624)',
        borderRadius: '16px',
        padding: '36px',
        maxWidth: '680px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div>
        <p className="cx-eyebrow" style={{ color: 'var(--cx-accent, #c99355)', marginBottom: '6px' }}>
          <b>{'//'}</b> Reservations
        </p>
        <h2 style={{ fontSize: '26px', color: '#f5ede3', fontWeight: 600, margin: 0 }}>
          Reserve your table at brewns
        </h2>
        <p style={{ color: 'var(--cx-muted, #8e8d88)', fontSize: '14px', marginTop: '6px' }}>
          Join us for specialty coffee, slow roasts, and fresh kitchen favorites across Lahore.
        </p>
      </div>

      {/* Branch Selection */}
      <div className="cx-field">
        <span>1. Choose Branch</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {LOC_TITLES.map((title, index) => {
            const active = loc === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setLoc(index)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                  background: active ? 'rgba(201, 147, 85, 0.12)' : '#181817',
                  color: active ? '#f5ede3' : 'var(--cx-muted, #8e8d88)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date & Time */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
        <label className="cx-field">
          <span>Date</span>
          <input
            type="date"
            min={todayStr}
            value={date}
            onChange={(e) => pickDate(e.target.value)}
            required
            className="cx-input"
          />
        </label>
        <label className="cx-field">
          <span>Party Size</span>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="cx-select"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Guest' : 'Guests'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Time Slots */}
      <div className="cx-field">
        <span>2. Select Time Slot</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {TIME_SLOTS.map((slot) => {
            const active = time === slot;
            const gone = !openSlot(date, slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                disabled={gone}
                title={gone ? 'That time has passed today' : undefined}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                  background: active ? 'var(--cx-accent, #c99355)' : '#181817',
                  color: active ? '#111' : '#f5ede3',
                  fontWeight: active ? 700 : 400,
                  fontSize: '13px',
                  cursor: gone ? 'not-allowed' : 'pointer',
                  opacity: gone ? 0.35 : 1,
                  textDecoration: gone ? 'line-through' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seating Area */}
      <div className="cx-field">
        <span>3. Preferred Seating Area</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {SEATING_AREAS.map((a) => {
            const active = area === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                  background: active ? 'rgba(201, 147, 85, 0.12)' : '#181817',
                  color: active ? '#f5ede3' : 'var(--cx-muted, #8e8d88)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: active ? 600 : 500, fontSize: '14px' }}>
                  <span>{a.label}</span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, lineHeight: 1.3 }}>{a.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
        <label className="cx-field">
          <span>Your Name</span>
          <input
            type="text"
            placeholder="e.g. Mahira Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="cx-input"
          />
        </label>
        <label className="cx-field">
          <span>Mobile Phone</span>
          <input
            type="tel"
            placeholder="0300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="cx-input"
          />
        </label>
      </div>

      <label className="cx-field">
        <span>Email Address</span>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="cx-input"
        />
      </label>

      <label className="cx-field">
        <span>Special Requests / Notes (Optional)</span>
        <input
          type="text"
          placeholder="Quiet corner for working, baby high chair, anniversary surprise..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="cx-input"
        />
      </label>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="cx-btn primary big block"
        disabled={busy}
        style={{ marginTop: '8px', fontSize: '16px' }}
      >
        {busy ? 'Securing Table…' : `Confirm Table for ${guests} ${guests === 1 ? 'Guest' : 'Guests'}`}
      </button>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--cx-muted, #8e8d88)' }}>
        No cancellation fee. Need to modify or cancel? Simply reply to your booking email or call the café directly.
      </div>
    </form>
  );
}
