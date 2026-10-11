import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentStaff } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Forgot your password · brewns team', robots: { index: false } };

/** For anyone on the team, the owner included: a link to choose a new password goes to the email on the account. */
export default async function StaffForgot() {
  if (await currentStaff()) redirect('/dashboard');
  return (
    <AuthFrame title={<>Locked<br />out?</>} lede="Tell us the work email on your account and we’ll send you a link to choose a new password.">
      <AuthForm
        eyebrow="Team and owner sign-in"
        heading="Forgot your password"
        action="/api/auth/staff-forgot"
        submit="Send me a link"
        fields={[{ name: 'email', label: 'Work email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' }]}
        footer={
          <p>
            Remembered it? <Link href="/staff/signin">Sign in</Link>
          </p>
        }
      />
    </AuthFrame>
  );
}
