import type { Metadata } from 'next';
import { TeamScreen } from '@/components/console/TeamScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Team · brewns console' };

export default async function Page() {
  await staffPage('staff');
  return <TeamScreen />;
}
