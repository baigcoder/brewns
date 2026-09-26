import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { ownerExists } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Set up brewns · owner sign-up', robots: { index: false } };

const POINTS = ['Live orders from the site, the counter and every table', 'A kitchen screen for the bar and the kitchen', 'Riders, tables, sold-out, promo codes', 'Sales and shop reports', 'Your team, with exactly the access each role needs'];

export default async function OwnerSignup() {
  await connection();
  const taken = await ownerExists();
  const needsCode = !!process.env.OWNER_SETUP_CODE || process.env.NODE_ENV === 'production';
  return (
    <AuthFrame title={<>Run brewns<br />from here.</>} lede="The owner account runs the café: orders, kitchen, floor, riders, menu, reports, and who on the team can do what." points={POINTS}>
      {taken ? (
        <div className="auth-form">
          <p className="cx-eyebrow">
            <b>{'//'}</b> Owner sign-up
          </p>
          <h2>Already set up.</h2>
          <p className="cx-muted">This café has an owner. To add another owner, an owner invites them from the Team page.</p>
          <Link className="cx-btn primary big block" href="/owner/signin">
            Sign in
          </Link>
        </div>
      ) : (
        <AuthForm
          eyebrow="Owner sign-up · one time"
          heading="Create the owner account"
          action="/api/auth/owner-signup"
          submit="Create account and open the console"
          fields={[
            { name: 'name', label: 'Your name', autoComplete: 'name', maxLength: 60 },
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters, with letters and a number.' },
            ...(needsCode ? [{ name: 'code', label: 'Setup code', type: 'password', autoComplete: 'off', hint: 'The OWNER_SETUP_CODE set on the server, so only you can claim the café.' }] : []),
          ]}
          footer={
            <p>
              Already have an account? <Link href="/owner/signin">Sign in</Link>
            </p>
          }
        />
      )}
    </AuthFrame>
  );
}
