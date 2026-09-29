import type { Metadata } from 'next';
import ReviewForm from '@/components/site/ReviewForm';

export const metadata: Metadata = { title: 'Rate your order — brewns', robots: { index: false, follow: false } };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ k?: string }> }) {
  const { number } = await params;
  const { k } = await searchParams;
  return <ReviewForm number={number} keyToken={typeof k === 'string' ? k : ''} />;
}
