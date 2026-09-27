import type { Metadata } from 'next';
import { DeliveriesScreen } from '@/components/console/DeliveriesScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Deliveries · brewns console' };

export default async function Page() {
  await staffPage('deliveries');
  return <DeliveriesScreen />;
}
