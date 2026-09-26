import type { Metadata } from 'next';
import { AccountScreen } from '@/components/console/AccountScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'My account · brewns console' };

export default async function Page() {
  await staffPage('account');
  return <AccountScreen />;
}
