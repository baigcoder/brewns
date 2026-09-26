import type { Metadata } from 'next';
import { OverviewScreen } from '@/components/console/OverviewScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Overview · brewns console' };

export default async function Page() {
  await staffPage('overview');
  return <OverviewScreen />;
}
