import React from 'react';
import { InviteForm } from './InviteForm';

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteForm token={token} />;
}
