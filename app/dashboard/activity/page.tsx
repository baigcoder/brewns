import type { Metadata } from 'next';
import { ActivityScreen } from '@/components/console/ActivityScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Activity · brewns console' };

export default async function Page() {
  await staffPage('activity');
  return <ActivityScreen />;
}
