import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { StaffSignupForm } from '@/components/auth/StaffSignupForm';
import { currentStaff } from '@/lib/server/auth';

export const metadata: Metadata = {
  title: 'Join the team · Staff sign-up · brewns',
  robots: { index: false },
};

const POINTS = [
  'Barista, Chef, Waiter, Cashier, Rider & Manager roles',
  'Real-time stations: Live kitchen tickets & floor calls',
  'Lahore counters: MM Alam, DHA Phase 5 & Johar Town',
];

export default async function StaffSignupPage() {
  if (await currentStaff()) redirect('/dashboard');

  return (
    <AuthFrame
      title={<>Join the<br />brewns team.</>}
      lede="Baristas, chefs, waiters, cashiers, riders and managers: pick your role and get access to your station."
      points={POINTS}
    >
      <StaffSignupForm />
    </AuthFrame>
  );
}
