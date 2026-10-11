import { describe, expect, it } from 'bun:test';
import { auditCategory, auditCsv } from '@/lib/auditKinds';

const cat = (action: string, kind?: string) => auditCategory({ action, kind });

describe('auditCategory', () => {
  it('knows security events, new and old', () => {
    expect(cat('Failed sign-in: wrong password', 'security')).toBe('security');
    expect(cat('Signed in')).toBe('security');
    expect(cat('Turned on two-step sign-in')).toBe('security');
    expect(cat('Changed their password')).toBe('security');
    expect(cat('Blocked: tried something their role does not allow')).toBe('security');
    expect(cat('Sign-in locked after too many tries')).toBe('security');
  });

  it('knows team and access changes', () => {
    expect(cat('Invited Sara as barista')).toBe('team');
    expect(cat('Gave “Take payment” to baristas')).toBe('team');
    expect(cat('Took “Sold out” from chefs')).toBe('team');
    expect(cat('Reset the barista role to its defaults')).toBe('team');
    expect(cat('Ahmed: role → manager')).toBe('team');
    expect(cat('Ahmed: switched off')).toBe('team');
  });

  it('knows orders, and menu and shops', () => {
    expect(cat('Took order #1001')).toBe('orders');
    expect(cat('Cancelled · #1002')).toBe('orders');
    expect(cat('Marked sold out')).toBe('menu');
    expect(cat('Created a promo code')).toBe('menu');
    expect(cat('Switched off orders through the console')).toBe('menu');
    expect(cat('Approved a customer moment')).toBe('menu');
  });

  it('puts the rest under other', () => {
    expect(cat('Did a thing')).toBe('other');
  });
});

describe('auditCsv', () => {
  const entries = [{ t: Date.UTC(2026, 2, 1, 7, 0, 0), name: 'Sara "Ace" Khan', role: 'cashier', action: 'Took order #1001', detail: 'Table 4, Rs 900' }];

  it('writes a header, quotes everything, and shows Pakistan time', () => {
    const [head, row] = auditCsv(entries).split('\r\n');
    expect(head).toBe('"Time (Pakistan)","Person","Role","Category","What happened","Detail"');
    expect(row).toBe('"2026-03-01 12:00:00","Sara ""Ace"" Khan","cashier","orders","Took order #1001","Table 4, Rs 900"');
  });

  it('stops spreadsheet formulas from running', () => {
    const [, row] = auditCsv([{ ...entries[0], name: '=HYPERLINK("http://evil")', detail: '+1+1' }]).split('\r\n');
    expect(row.includes('"\'=HYPERLINK(""http://evil"")"')).toBe(true);
    expect(row.endsWith('"\'+1+1"')).toBe(true);
  });
});
