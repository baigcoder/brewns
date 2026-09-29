import type { Metadata } from 'next';
import { RefundsScreen } from '@/components/console/RefundsScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Refunds · brewns console' };

export default async function Page() {
  await staffPage('refunds');
  return <RefundsScreen />;
}
