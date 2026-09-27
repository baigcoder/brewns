import type { Metadata } from 'next';
import { BookingsScreen } from '@/components/console/BookingsScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Bookings & AI calls · brewns console' };

export default async function Page() {
  await staffPage('bookings');
  return <BookingsScreen />;
}
