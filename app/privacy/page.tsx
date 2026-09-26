import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import '../legal.css';

export const metadata: Metadata = {
  title: 'Privacy policy — brewns',
  description: 'What brewns keeps about you when you order, join brewns Club or write to us, where it goes, and how to have it removed.',
  alternates: { canonical: '/privacy' },
};

/* Keep this in step with what the site actually does: the localStorage keys in
   initBrewns.ts and lib/audio-ritual.ts, and where forms are sent
   (NEXT_PUBLIC_ORDER_ENDPOINT). */
export default function Privacy() {
  return (
    <LegalPage eyebrow="PRIVACY POLICY" title="What we keep, and why." updated="25 SEPTEMBER 2026">
      <p className="legal-lede">
        brewns coffee house (&ldquo;brewns&rdquo;, &ldquo;we&rdquo;) runs three coffee shops in Lahore and this website. We ask for as little as we can, use it to make your coffee and get it to
        you, and never sell it.
      </p>

      <h2>What we ask for</h2>
      <ul>
        <li>
          <b>When you order:</b> your name, mobile number, delivery address if you want delivery, an email address if you want a receipt, any note for the barista or rider, and what
          you ordered.
        </li>
        <li>
          <b>When you join brewns Club:</b> your name, mobile number and, if you choose, the day and month of your birthday (never the year).
        </li>
        <li>
          <b>When you send an enquiry</b> about events, wholesale or a job: your name, mobile, email if you give it, and what you tell us.
        </li>
        <li>
          <b>When you subscribe to The Pour,</b> our newsletter: your email address.
        </li>
      </ul>

      <h2>Where it goes</h2>
      <ul>
        <li>
          <b>To the café.</b> Orders, enquiries and newsletter sign-ups are emailed to our team through a form-to-email service. If you have no connection to that service, your own email
          app opens with the message filled in, and you choose whether to send it.
        </li>
        <li>
          <b>To your rider,</b> for deliveries: your first name, mobile number and address, so they can find you.
        </li>
        <li>
          <b>Nowhere else.</b> We do not sell, rent or trade personal information, and we do not use advertising or tracking cookies.
        </li>
      </ul>

      <h2>What stays on your device</h2>
      <p>
        Some things are kept only in your browser&rsquo;s storage, on your phone or computer, so the site remembers them next time. We cannot see them unless you send them to us.
      </p>
      <ul>
        <li>Your bag, your recent orders and their messages, and the details you entered at checkout, so you don&rsquo;t have to type them again.</li>
        <li>Your brewns Club card: stamps, free drinks and their history.</li>
        <li>Reviews you write and the reviews you marked as helpful. For now these are shown only on your device.</li>
        <li>Your sound settings, and whether you subscribed to The Pour.</li>
      </ul>
      <p>
        Clearing this site&rsquo;s data in your browser removes all of it, including your club card. In the club section, <i>Leave the club</i> removes the card alone.
      </p>

      <h2>Services we rely on</h2>
      <ul>
        <li>
          <b>Hosting.</b> The site is served by Vercel, which keeps short-lived logs of requests (such as IP addresses) to keep the service secure and working.
        </li>
        <li>
          <b>Fonts.</b> Some typefaces load from Google Fonts, which sees your IP address when they do.
        </li>
        <li>
          <b>Links you choose to follow:</b> WhatsApp, Google Maps, Instagram and TikTok have their own privacy policies.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Order emails and invoices are kept for as long as tax law requires us to keep sales records, and no longer. Enquiries are kept until they are answered and any event or job has
        ended. You stay on The Pour until you unsubscribe.
      </p>

      <h2>Your choices</h2>
      <p>
        Write to <a href="mailto:hello@brewns.coffee">hello@brewns.coffee</a> and we will tell you what we hold about you, correct it, or delete it, unless we have to keep an invoice
        by law. Every newsletter has a way to unsubscribe.
      </p>

      <h2>Children</h2>
      <p>The site is for adults. If you are under 13, please ask a parent or guardian to order for you.</p>

      <h2>Changes</h2>
      <p>If we change how we use your information, we will update this page and the date at the top before the change takes effect.</p>
    </LegalPage>
  );
}
