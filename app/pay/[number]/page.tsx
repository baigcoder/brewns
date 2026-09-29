import type { Metadata } from 'next';
import PayForm from '@/components/site/PayForm';

export const metadata: Metadata = { title: 'Pay for your order — brewns', robots: { index: false, follow: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ k?: string }> }) {
  const { number } = await params;
  const { k } = await searchParams;
  return <PayForm number={number} keyToken={typeof k === 'string' ? k : ''} />;
}
