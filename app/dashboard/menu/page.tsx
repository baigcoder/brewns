import type { Metadata } from 'next';
import { MenuScreen } from '@/components/console/MenuScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Menu · brewns console' };

export default async function Page() {
  await staffPage('menu');
  return <MenuScreen />;
}
