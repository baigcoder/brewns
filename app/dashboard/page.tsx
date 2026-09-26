import { redirect } from 'next/navigation';
import { homeFor } from '@/lib/rbac';
import { staffPage } from '@/lib/server/auth';

/** /dashboard: straight to the screen that is this person's job. */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await staffPage('account');
  const { denied } = await searchParams;
  const home = homeFor(ctx.role, ctx.perms);
  redirect(denied ? `${home}?denied=${encodeURIComponent(denied)}` : home);
}
