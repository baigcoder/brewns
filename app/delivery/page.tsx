import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { DELIVERY, LOC_TITLES, money } from '@/lib/catalog';
import { publicPageMetadata } from '@/lib/siteMetadata';
import '../legal.css';

export const metadata: Metadata = publicPageMetadata(
  'Delivery · brewns Lahore',
  `Where brewns delivers in Lahore, what it costs and how long it takes. Free delivery over ${money(DELIVERY.freeOver)}.`,
  '/delivery',
);

const title = (s: string) => s.toLowerCase().replace(/(^|[\s–-])(\p{L})/gu, (_, sp, ch) => sp + ch.toUpperCase());

/* The numbers come from the checkout itself (lib/catalog.ts DELIVERY), so this
   page can never promise a fee or a time the checkout doesn't charge. */
export default function Delivery() {
  return (
    <LegalPage eyebrow="DELIVERY" title="Hot to your door." updated="20 OCTOBER 2026">
      <p className="legal-lede">
        We deliver across central Lahore from the nearest of our three counters, usually in 30 to 45 minutes. The minimum order is {money(DELIVERY.min)}, and delivery is free on orders over{' '}
        {money(DELIVERY.freeOver)}.
      </p>

      <h2>Where we deliver</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Sent from</th>
              <th scope="col">Fee</th>
              <th scope="col">Usually</th>
            </tr>
          </thead>
          <tbody>
            {DELIVERY.areas.map(([area, shop, fee, min]) => (
              <tr key={area}>
                <td>{title(area)}</td>
                <td>{LOC_TITLES[shop]}</td>
                <td>{money(fee)}</td>
                <td>{min} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Over {money(DELIVERY.freeOver)}, the fee is on us. Outside these areas, choose pickup and collect from the counter of your choice; it’s ready when you arrive.</p>

      <h2>How it works</h2>
      <ul>
        <li>
          <b>Order ahead</b> on the <Link href="/#order">menu</Link>, choose delivery and your area. You see the fee before you place the order.
        </li>
        <li>
          <b>Follow it live:</b> your order page shows every stage, from the bar to the rider, with real times.
        </li>
        <li>
          <b>Pay on arrival:</b> cash, card, or JazzCash and Easypaisa through our Raast QR, to the rider. Nothing is charged online.
        </li>
        <li>
          <b>Need to change something?</b> Message the café from your order page; until the barista starts, you can still cancel. See <Link href="/refunds">refunds and cancellations</Link>.
        </li>
      </ul>

      <h2>Packaging</h2>
      <p>Hot drinks travel with plant-based lids and recycled paper sleeves.</p>

      <h2>Questions</h2>
      <p>
        Call <a href="tel:+924212345678">+92 42 1234 5678</a> or write to <a href="mailto:hello@brewns.coffee">hello@brewns.coffee</a>, 07:00 to 21:00 every day.
      </p>
    </LegalPage>
  );
}
