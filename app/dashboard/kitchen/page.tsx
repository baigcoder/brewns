import type { Metadata } from 'next';
import { KitchenScreen } from '@/components/console/KitchenScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Kitchen · brewns console' };

export default async function Page() {
  await staffPage('kitchen');
  return <KitchenScreen />;
}
