import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentCustomer } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Forgot your password · brewns', robots: { index: false } };

export default async function Forgot() {
  if (await currentCustomer()) redirect('/account');
  return (
    <AuthFrame title={<>Locked<br />out?</>} lede="Tell us the email on your account and we'll send you a link to choose a new password.">
      <AuthForm
        eyebrow="Your brewns account"
        heading="Forgot your password"
        action="/api/account/forgot"
        submit="Send me a link"
        fields={[{ name: 'email', label: 'Your email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' }]}
        footer={
          <p>
            Remembered it? <Link href="/account/signin">Sign in</Link>
          </p>
        }
      />
    </AuthFrame>
  );
}
