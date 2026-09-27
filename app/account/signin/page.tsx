import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentCustomer } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Sign in · brewns', robots: { index: false } };

export default async function CustomerSignin() {
  if (await currentCustomer()) redirect('/account');
  return (
    <AuthFrame title={<>Welcome<br />back.</>} lede="Your orders on any phone, your details filled in at checkout, and your club card wherever you are.">
      <AuthForm
        eyebrow="Your brewns account"
        heading="Sign in"
        action="/api/auth/signin"
        extra={{ kind: 'customer' }}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Email or mobile', autoComplete: 'username', placeholder: 'you@example.com or 0300 1234567' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
        footer={
          <>
            <p>
              No account yet? <Link href="/account/signup">Create one</Link> in a minute.
            </p>
            <p>
              Work at brewns? <Link href="/staff/signin">Staff sign-in</Link>
            </p>
          </>
        }
      />
    </AuthFrame>
  );
}
