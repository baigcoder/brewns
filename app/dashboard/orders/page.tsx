import type { Metadata } from 'next';
import { OrdersScreen } from '@/components/console/OrdersScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Orders · brewns console' };

export default async function Page() {
  await staffPage('orders');
  return <OrdersScreen />;
}
