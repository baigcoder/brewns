import type { Metadata } from 'next';
import { PayrollScreen } from '@/components/console/PayrollScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Payroll · brewns console' };

export default async function Page() {
  await staffPage('payroll');
  return <PayrollScreen />;
}
