import type { Metadata } from 'next';
import { ReservationForm } from '@/components/reserve/ReservationForm';
import { SitePage } from '@/components/site/SitePage';

export const metadata: Metadata = {
  title: 'Table Reservations · brewns Lahore',
  description: 'Book a table or coffee bar seat at brewns MM Alam Road, DHA Phase 5, or Johar Town.',
};

export default function ReservePage() {
  return (
    <SitePage current="reserve" width={900}>
      <ReservationForm />
    </SitePage>
  );
}
