import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import '../console.css';
import { AccountHome } from '@/components/auth/AccountHome';
import { currentCustomer } from '@/lib/server/auth';
import { clubOf, customerView } from '@/lib/server/customers';

export const metadata: Metadata = { title: 'Your account · brewns', robots: { index: false } };

export default async function Account() {
  const u = await currentCustomer();
  if (!u) redirect('/account/signin?next=/account');
  return <AccountHome user={customerView(u)} club={await clubOf(u)} />;
}
