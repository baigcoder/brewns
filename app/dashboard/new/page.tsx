import type { Metadata } from 'next';
import { PosScreen } from '@/components/console/PosScreen';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'New order · brewns console' };

/** Opened from a table on the Floor as /dashboard/new?loc=0&table=4. */
export default async function Page({ searchParams }: { searchParams: Promise<{ loc?: string; table?: string }> }) {
  await staffPage('new');
  const q = await searchParams;
  const loc = Number(q.loc);
  const table = Number(q.table);
  return <PosScreen startLoc={Number.isInteger(loc) ? loc : undefined} startTable={Number.isInteger(table) && table > 0 ? table : undefined} />;
}
