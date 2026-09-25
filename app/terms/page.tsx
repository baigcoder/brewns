import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import '../legal.css';

export const metadata: Metadata = {
  title: 'Terms of use — brewns',
  description: 'Ordering, delivery, payment, gift cards, subscriptions and brewns Club: the terms for buying from brewns coffee house in Lahore.',
  alternates: { canonical: '/terms' },
};

/* The numbers here (tax, delivery, club) restate the site's data in
   initBrewns.ts and components/brewns/club.ts: change both together. */
export default function Terms() {
  return (
    <LegalPage eyebrow="TERMS OF USE" title="The small print, kept small." updated="25 SEPTEMBER 2026">
      <p className="legal-lede">
        These terms apply when you use this website or buy from brewns coffee house (&ldquo;brewns&rdquo;, &ldquo;we&rdquo;) at MM Alam Road, CCA DHA Phase 5 or Main Boulevard, Johar
        Town, Lahore.
      </p>

      <h2 id="orders">Orders and prices</h2>
      <ul>
        <li>Prices are in Pakistani rupees. The menu, prices and what is available can change, and some items sell out during the day.</li>
        <li>
          Punjab sales tax is added at checkout: 16% on bills paid in cash, 5% on bills paid by card or mobile wallet. The rate that applies is shown before you place the order.
        </li>
        <li>Photos show how we serve things; your cup or plate may look a little different.</li>
        <li>An order is confirmed when the confirmation screen shows its order number.</li>
      </ul>

      <h2 id="delivery">Pickup and delivery</h2>
      <ul>
        <li>Pickup and delivery times are estimates. We will message you if we are running late.</li>
        <li>
          We deliver to the areas listed at checkout. The minimum order for delivery is Rs 1,000; delivery costs Rs 150 to Rs 300 by area and is free on orders over Rs 3,000.
        </li>
        <li>Please be reachable on the mobile number you gave. If a rider cannot reach you, we will hold the order at the shop for collection.</li>
      </ul>

      <h2 id="payment">Payment</h2>
      <p>Nothing is charged online. You pay at the counter or to the rider, in cash, by card, or by JazzCash or Easypaisa through our Raast QR code.</p>

      <h2 id="changes">Changes, cancellations and problems</h2>
      <ul>
        <li>You can cancel an order from its tracking page until the barista starts making it. After that we cannot cancel it, but message us and we will do what we can.</li>
        <li>If something is wrong with your order, tell us within 24 hours at the shop, by WhatsApp or by email, and we will remake it or refund it.</li>
      </ul>

      <h2 id="subscriptions">Bean subscriptions</h2>
      <p>
        A subscription sends the same bag every two or four weeks at 10% off. You can skip a delivery, change the beans or grind, or cancel at any time by messaging us before the next
        bag is roasted.
      </p>

      <h2 id="gift-cards">Gift cards</h2>
      <ul>
        <li>Gift cards never expire and work at all three shops. Any balance carries over to your next visit.</li>
        <li>They cannot be exchanged for cash. If you lose the email, any barista can find the card by the name it was bought for.</li>
      </ul>

      <h2 id="club">brewns Club</h2>
      <ul>
        <li>brewns Club is free to join, for one person per mobile number. You get one welcome stamp when you join.</li>
        <li>
          Each drink on an order earns one stamp, two for orders placed before 09:00. A drink taken as a free drink does not earn a stamp. Stamps from an order that is cancelled are
          taken back, and a free drink it used is given back.
        </li>
        <li>Ten stamps make one free drink of your choice, worth up to Rs 1,500; above that you pay the difference. Free drinks have no cash value.</li>
        <li>If you give us your birthday, you get one free drink in the week of your birthday, once a year.</li>
        <li>
          Your card is kept on the device you joined on. Clearing your browser&rsquo;s data for this site removes it, and we cannot restore it.
        </li>
        <li>We may change or end the club with 30 days&rsquo; notice on this page. Free drinks you have already earned stay usable until then.</li>
      </ul>

      <h2 id="promos">Promo codes</h2>
      <p>One promo code per order. Codes have no cash value and cannot be used after they expire.</p>

      <h2 id="events">Events and catering</h2>
      <p>An enquiry is not a booking. Your event is booked once we have confirmed the date, menu and price with you in writing.</p>

      <h2 id="allergens">Allergies</h2>
      <p>
        Our kitchen and bar handle wheat, milk, eggs, nuts and sesame. Tell us about any allergy before you order; we will check every ingredient with you, but we cannot promise that
        anything is completely free of them.
      </p>

      <h2 id="reviews">Reviews</h2>
      <p>Reviews should be honest and about your own visit or order. We may remove reviews that are abusive, off-topic or advertising.</p>

      <h2 id="site">This website</h2>
      <p>
        The brewns name, logo, photos and text on this site belong to brewns coffee house. We work to keep the site accurate and running, but it is provided as it is, and we are not
        responsible for losses caused by it being unavailable.
      </p>

      <h2 id="law">Law</h2>
      <p>These terms are governed by the laws of Pakistan, and the courts of Lahore will hear any dispute about them.</p>

      <h2 id="updates">Changes to these terms</h2>
      <p>We may update these terms. The date at the top shows when they last changed, and the terms at the time of your order apply to it.</p>
    </LegalPage>
  );
}
