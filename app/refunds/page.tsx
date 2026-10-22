import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { publicPageMetadata } from '@/lib/siteMetadata';
import '../legal.css';

export const metadata: Metadata = publicPageMetadata(
  'Refunds & cancellations · brewns',
  'How to cancel or change a brewns order, and what we do when something isn’t right.',
  '/refunds',
);

/* Keep in step with what the order page allows (lib/server/orders.ts:
   customerAct cancel, refunds) and the FAQ's "Can I change or cancel an order?". */
export default function Refunds() {
  return (
    <LegalPage eyebrow="REFUNDS & CANCELLATIONS" title="If it isn’t right, we fix it." updated="20 OCTOBER 2026">
      <p className="legal-lede">Every cup is made to order, so we would rather know straight away when something is wrong.</p>

      <h2>Cancelling an order</h2>
      <ul>
        <li>
          <b>Until the barista starts making it</b>, you can cancel: open your order and tap <i>Cancel order</i>, or message the café from the order page.
        </li>
        <li>
          <b>Once it is being made</b>, we can’t cancel it, but we can usually still change the milk or the pickup time.
        </li>
        <li>Nothing is charged online, so a cancelled order costs you nothing.</li>
      </ul>

      <h2>When something isn’t right</h2>
      <ul>
        <li>
          <b>A wrong or missing item, a spill, or a drink that isn’t how it should be:</b> message us from your order page, call the counter, or tell the rider, and we will put it right.
        </li>
        <li>
          <b>At the counter:</b> just tell the barista. We would always rather make it again.
        </li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>Refunds go back the way you paid: cash at the counter, or back to your JazzCash, Easypaisa or Raast account.</p>

      <h2>Allergies</h2>
      <p>
        Our kitchen handles wheat, milk, eggs, nuts and sesame. Tell the barista about any allergy, or add it as a note on your order, and we will check every ingredient with you. Each product’s allergens are listed in the{' '}
        <Link href="/shop">shop</Link>.
      </p>

      <h2>Get in touch</h2>
      <p>
        Call <a href="tel:+924212345678">+92 42 1234 5678</a> or write to <a href="mailto:hello@brewns.coffee">hello@brewns.coffee</a>, 07:00 to 21:00 every day.
      </p>
    </LegalPage>
  );
}
