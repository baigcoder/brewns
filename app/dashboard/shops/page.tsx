import type { Metadata } from 'next';
import { ShopsScreen } from '@/components/console/ShopsScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Shops · brewns console' };

export default async function Page() {
  await staffPage('shops');
  return <ShopsScreen />;
}
