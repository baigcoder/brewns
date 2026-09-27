import type { Metadata } from 'next';
import { FloorScreen } from '@/components/console/FloorScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Floor · brewns console' };

export default async function Page() {
  await staffPage('floor');
  return <FloorScreen />;
}
