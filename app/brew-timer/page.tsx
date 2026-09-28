import { BrewTimer } from '@/components/brew/BrewTimer';
import { SitePage } from '@/components/site/SitePage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Brew Timer & Ratio Calculator · brewns',
  'Interactive pour-over stopwatch and ratio companion for V60, Chemex, AeroPress and French Press with step-by-step guidance.',
  '/brew-timer',
);

export default function BrewTimerPage() {
  return (
    <SitePage current="brew-timer" width={1040}>
      <BrewTimer />
    </SitePage>
  );
}
