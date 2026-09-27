import type { Metadata } from 'next';
import { MomentsScreen } from '@/components/console/MomentsScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Moments Gallery · brewns console' };

export default async function Page() {
  await staffPage('moments');
  return <MomentsScreen />;
}
