/* The activity log: every staff action that changes something, newest first,
   the last thousand kept. Shown on the console's Activity page. */

import { kv } from './store';

export type AuditEntry = { t: number; uid: string; name: string; role: string; action: string; detail: string };
export type Actor = { id: string; name: string; role: string };

export const audit = async (actor: Actor | null, action: string, detail = '') => {
  await kv.push('audit', { t: Date.now(), uid: actor?.id || '', name: actor?.name || 'System', role: actor?.role || '', action, detail } satisfies AuditEntry, 1000);
  await kv.incr('audit:v');
};

export const readAudit = (limit = 200) => kv.list<AuditEntry>('audit', 0, limit - 1);
export const auditVersion = () => kv.num('audit:v');
