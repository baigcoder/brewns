import type { Metadata } from 'next';
import { CustomersScreen } from '@/components/console/CustomersScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Customers · brewns console' };

export default async function Page() {
  await staffPage('customers');
  return <CustomersScreen />;
}
