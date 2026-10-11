import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { resetUser } from '@/lib/server/passwordReset';

export const metadata: Metadata = { title: 'New password · brewns', robots: { index: false }, referrer: 'no-referrer' };

/** The link from the reset email: sets a new password, then signs in. */
export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await resetUser(token);
  return (
    <AuthFrame title={<>A new<br />password.</>} lede="Choose one you haven't used here before. You'll be signed in right after, and signed out everywhere else.">
      {user ? (
        <AuthForm
          eyebrow="Password reset"
          heading={`New password, ${user.name.split(' ')[0]}`}
          action="/api/account/reset"
          extra={{ token }}
          submit="Save and sign in"
          fields={[{ name: 'password', label: 'Choose a password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters, with letters and a number.' }]}
        />
      ) : (
        <div className="auth-form">
          <p className="cx-eyebrow">
            <b>{'//'}</b> Reset link
          </p>
          <h2>This link doesn’t work any more.</h2>
          <p className="cx-muted">Reset links work once and last an hour, and a newer link replaces an older one. Ask for a fresh one.</p>
          <Link className="cx-btn primary big block" href="/account/forgot">
            Send me a new link
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}
