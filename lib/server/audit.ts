/* The activity log: every staff action that changes something, newest first.
   Shown on the console's Activity page.

   Two lists feed it. Business actions (orders, menu, team) keep the last
   thousand. Security events (sign-ins, failed tries, lockouts, two-step, blocked
   attempts) keep their own last five hundred, so anyone hammering the sign-in
   form can never push real entries out of the log. The page reads both. */

import { kv } from './store';

export type AuditEntry = { t: number; uid: string; name: string; role: string; action: string; detail: string; kind?: 'security' };
export type Actor = { id: string; name: string; role: string };

const BUSINESS = 'audit';
const SECURITY = 'audit:sec';

export const audit = async (actor: Actor | null, action: string, detail = '', kind?: 'security') => {
  const entry: AuditEntry = { t: Date.now(), uid: actor?.id || '', name: actor?.name || 'System', role: actor?.role || '', action, detail, ...(kind ? { kind } : {}) };
  await kv.push(kind === 'security' ? SECURITY : BUSINESS, entry, kind === 'security' ? 500 : 1000);
  await kv.incr('audit:v');
  // The few security events an owner should hear about at once also go to their email.
  if (kind === 'security') {
    const { ALERT_ACTIONS, alertOwners } = await import('./alerts');
    if (ALERT_ACTIONS.test(action)) await alertOwners(action, `${entry.name}${entry.role ? ` (${entry.role})` : ''}${detail ? `: ${detail}` : ''}`, `${action}:${entry.uid || entry.name}`);
  }
};

/** A security event, at most once per `ttlSec` for the same `gate` (so a flood of identical failures is one line, not hundreds). */
export async function securityOnce(gate: string, ttlSec: number, actor: Actor | null, action: string, detail = '') {
  if ((await kv.incr(`secgate:${gate}`, ttlSec)) !== 1) return;
  await audit(actor, action, detail, 'security');
}

/** Both lists merged, newest first. */
export async function readAudit(limit = 200): Promise<AuditEntry[]> {
  const [business, security] = await Promise.all([kv.list<AuditEntry>(BUSINESS, 0, limit - 1), kv.list<AuditEntry>(SECURITY, 0, limit - 1)]);
  return [...business, ...security.map((e) => ({ ...e, kind: 'security' as const }))].sort((a, b) => b.t - a.t).slice(0, limit);
}
export const auditVersion = () => kv.num('audit:v');
