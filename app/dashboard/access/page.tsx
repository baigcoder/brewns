import type { Metadata } from 'next';
import { AccessScreen } from '@/components/console/AccessScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Access · brewns console' };

export default async function Page() {
  await staffPage('access');
  return <AccessScreen />;
}
