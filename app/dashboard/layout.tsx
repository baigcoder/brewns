import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import '../console.css';
import { Shell } from '@/components/console/Shell';
import { currentStaff } from '@/lib/server/auth';
import { storeInfo } from '@/lib/server/store';

export const metadata: Metadata = { title: 'brewns console', robots: { index: false, follow: false } };

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const ctx = await currentStaff();
  if (!ctx) redirect('/staff/signin');
  const { user, role, perms } = ctx;
  const { ephemeral, kind } = storeInfo();
  return (
    <Shell me={{ id: user.id, name: user.name, email: user.email, role, shops: user.shops }} perms={perms} store={{ ephemeral, kind }}>
      {children}
    </Shell>
  );
}
