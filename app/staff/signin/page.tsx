import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { currentStaff } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Staff sign-in · brewns', robots: { index: false } };

export default async function StaffSignin() {
  if (await currentStaff()) redirect('/dashboard');
  return (
    <AuthFrame
      title={<>Behind<br />the counter.</>}
      lede="Baristas, chefs, waiters, cashiers and riders: sign in and you land on your own screen."
      points={['Kitchen: tickets for the bar and the kitchen', 'Floor: tables, calls, serving, bills', 'Counter: orders, payments, pickups', 'Riders: your deliveries, maps and cash']}
    >
      <AuthForm
        eyebrow="Staff sign-in"
        heading="Sign in"
        action="/api/auth/signin"
        extra={{ kind: 'staff' }}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Work email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
        footer={
          <>
            <p>New here? Open the invite link your manager sent you.</p>
            <p>Forgot your password? Ask the owner or a manager for a new link.</p>
            <p>
              The owner? <Link href="/owner/signin">Owner sign-in</Link>
            </p>
          </>
        }
      />
    </AuthFrame>
  );
}
