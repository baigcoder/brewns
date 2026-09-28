import { ReservationForm } from '@/components/reserve/ReservationForm';
import { SitePage } from '@/components/site/SitePage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Table Reservations · brewns Lahore',
  'Book a table or coffee bar seat at brewns MM Alam Road, DHA Phase 5, or Johar Town.',
  '/reserve',
);

export default function ReservePage() {
  return (
    <SitePage current="reserve" width={900}>
      <ReservationForm />
    </SitePage>
  );
}
