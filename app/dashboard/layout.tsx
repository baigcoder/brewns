import React from 'react';
import { ConsoleShell } from '@/components/console/ConsoleShell';

export const metadata = {
  title: 'Staff Console · Brewns Coffee House',
  description: 'Operations, orders, KDS, and shop floor management for Brewns staff.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
