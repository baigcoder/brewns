import type { Metadata } from 'next';
import { MomentsScreen } from '@/components/console/MomentsScreen';
import { ReviewsCard } from '@/components/console/ReviewsCard';
import { staffPage } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Moments and reviews · brewns console' };

export default async function Page() {
  await staffPage('moments');
  return (
    <>
      <ReviewsCard />
      <MomentsScreen />
    </>
  );
}
