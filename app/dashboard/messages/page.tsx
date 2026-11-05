import type { Metadata } from 'next';
import { MessagesScreen } from '@/components/console/MessagesScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Team messages · brewns console' };

export default async function Page() {
  await staffPage('messages');
  return <MessagesScreen />;
}
