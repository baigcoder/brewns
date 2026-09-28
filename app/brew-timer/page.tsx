import type { Metadata } from 'next';
import { BrewTimer } from '@/components/brew/BrewTimer';
import { SitePage } from '@/components/site/SitePage';

export const metadata: Metadata = {
  title: 'Brew Timer & Ratio Calculator · brewns',
  description: 'Interactive pour-over stopwatch and ratio companion for V60, Chemex, AeroPress and French Press with step-by-step guidance.',
};

export default function BrewTimerPage() {
  return (
    <SitePage current="brew-timer" width={1040}>
      <BrewTimer />
    </SitePage>
  );
}
