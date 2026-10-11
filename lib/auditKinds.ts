/* Sorting the activity log into things a person can filter by, and turning it
   into a spreadsheet. Pure, so the Activity page and the tests share it.

   New security events carry `kind: 'security'`; older lines (before that existed)
   are recognised by their wording. */

export type AuditCategory = 'security' | 'team' | 'orders' | 'menu' | 'other';

export const AUDIT_CATEGORIES: readonly { key: AuditCategory; label: string }[] = [
  { key: 'security', label: 'Security' },
  { key: 'team', label: 'Team & access' },
  { key: 'orders', label: 'Orders & payments' },
  { key: 'menu', label: 'Menu & shops' },
];

type Line = { action: string; kind?: string };

export function auditCategory(e: Line): AuditCategory {
  if (e.kind === 'security') return 'security';
  const a = e.action.toLowerCase();
  if (/two-step|sign-in|signed in|signed out|password|recovery code|blocked|locked/.test(a)) return 'security';
  if (/(gave|took) “|reset the .* role|invited|withdrew the invite|asked to join|joined the team|owner account|^[^:]{1,60}: (role|shops|switched|signed out|new )/.test(a)) return 'team';
  if (/sold out|back on the menu|stock|promo|shop|moment|review|pay-first|online ordering|through the console|cloudinary|sample data|simulation/.test(a)) return 'menu';
  if (/order|payment|paid|refund|cancel|ready|handed|collected|delivered|rider|table|ticket|booking|confirmed|accepted|started|served/.test(a)) return 'orders';
  return 'other';
}

/** A cell that a spreadsheet will not run as a formula, quoted for CSV. */
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

const pkStamp = (t: number) => new Date(t + 5 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

export function auditCsv(entries: readonly { t: number; name: string; role: string; action: string; detail: string; kind?: string }[]): string {
  const head = ['Time (Pakistan)', 'Person', 'Role', 'Category', 'What happened', 'Detail'].map(cell).join(',');
  const rows = entries.map((e) => [pkStamp(e.t), e.name, e.role, auditCategory(e), e.action, e.detail].map((v) => cell(String(v ?? ''))).join(','));
  return [head, ...rows].join('\r\n');
}
