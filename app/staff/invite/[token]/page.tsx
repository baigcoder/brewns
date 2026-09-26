import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { LOC_TITLES } from '@/lib/catalog';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { allUsers, sha256 } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Join the team · brewns', robots: { index: false }, referrer: 'no-referrer' };

const expired = (exp: number) => exp <= Date.now();

/** An invite (or password reset) link: greets them by name and role, then sets the password. */
export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hash = sha256(token);
  const user = (await allUsers('staff')).find((u) => u.invite?.hash === hash);
  const valid = user && user.active && !expired(user.invite!.exp) && user.role !== 'customer';
  const role = user?.role as Role | undefined;
  const reset = !!user?.passHash;
  return (
    <AuthFrame
      title={valid && !reset ? <>Welcome to<br />brewns.</> : <>A new<br />password.</>}
      lede={valid && role ? `${ROLE_INFO[role].label} · ${user!.shops.length ? user!.shops.map((s) => LOC_TITLES[s]).join(', ') : 'all three shops'}. ${ROLE_INFO[role].blurb}` : 'This link lets you set a password for the brewns console.'}
    >
      {valid ? (
        <AuthForm
          eyebrow={reset ? 'Password reset' : `Invited by ${user!.invitedBy || 'the owner'}`}
          heading={reset ? `New password, ${user!.name.split(' ')[0]}` : `Hi ${user!.name.split(' ')[0]}`}
          action="/api/auth/invite"
          extra={{ token }}
          submit={reset ? 'Save and sign in' : 'Join and sign in'}
          fields={[
            ...(reset ? [] : [{ name: 'name', label: 'Your name, as the team will see it', value: user!.name, autoComplete: 'name', maxLength: 60 }]),
            { name: 'email', label: 'You’ll sign in with', value: user!.email, type: 'email', required: false, readOnly: true },
            { name: 'password', label: 'Choose a password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters, with letters and a number.' },
          ]}
        />
      ) : (
        <div className="auth-form">
          <p className="cx-eyebrow">
            <b>{'//'}</b> Invite link
          </p>
          <h2>{user && user.invite && expired(user.invite.exp) ? 'This link has expired.' : 'This link doesn’t work any more.'}</h2>
          <p className="cx-muted">Links work once, for 7 days, and a newer link replaces an older one. Ask the owner or a manager to send you a fresh one.</p>
          <Link className="cx-btn big block" href="/staff/signin">
            Staff sign-in
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}
