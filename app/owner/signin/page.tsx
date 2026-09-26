import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentStaff, ownerExists } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Owner sign-in · brewns', robots: { index: false } };

export default async function OwnerSignin() {
  if (await currentStaff()) redirect('/dashboard');
  const setUp = await ownerExists();
  return (
    <AuthFrame title={<>Good to<br />see you.</>} lede="Today’s sales, what’s on the pass, and the team, in one place.">
      <AuthForm
        eyebrow="Owner sign-in"
        heading="Sign in"
        action="/api/auth/signin"
        extra={{ kind: 'staff' }}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
        footer={
          <>
            {!setUp && (
              <p>
                First time? <Link href="/owner/signup">Create the owner account</Link>
              </p>
            )}
            <p>
              On the team? <Link href="/staff/signin">Staff sign-in</Link>
            </p>
            <p>Forgot your password? Another owner can send you a new link from the Team page.</p>
          </>
        }
      />
    </AuthFrame>
  );
}
