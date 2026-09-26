import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentCustomer } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Create an account · brewns', robots: { index: false } };

export default async function CustomerSignup() {
  if (await currentCustomer()) redirect('/account');
  return (
    <AuthFrame
      title={<>Your usual,<br />remembered.</>}
      lede="An account keeps your order history, fills in your details at checkout, and keeps your brewns Club card safe on every device."
      points={['Club stamps that follow you, not your phone', 'Every order and receipt in one place', 'Order again in two taps', 'Track any order live']}
    >
      <AuthForm
        eyebrow="New account"
        heading="Create an account"
        action="/api/account/signup"
        submit="Create account"
        withClub
        fields={[
          { name: 'name', label: 'Name', autoComplete: 'name', maxLength: 40 },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'phone', label: 'Mobile', type: 'tel', autoComplete: 'tel', placeholder: '0300 1234567', maxLength: 16 },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters, with letters and a number.' },
        ]}
        footer={
          <>
            <p>Already a club member on this phone? Your card comes with you into the account.</p>
            <p>
              Have an account? <Link href="/account/signin">Sign in</Link> · <Link href="/privacy">Privacy</Link>
            </p>
          </>
        }
      />
    </AuthFrame>
  );
}
