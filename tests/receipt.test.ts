import { describe, expect, it } from 'bun:test';
import type { ServerOrder } from '@/lib/orderFlow';
import { DEFAULT_BUSINESS, esc, invoiceNumber, kitchenSlipHtml, receiptHtml, tillSlipHtml } from '@/lib/receipt';

const order = (over: Partial<ServerOrder> = {}): ServerOrder =>
  ({
    number: 123,
    day: '2026-03-04',
    placed: Date.parse('2026-03-04T07:30:00Z'),
    target: 0,
    mode: 'pickup',
    loc: 0,
    area: null,
    table: null,
    address: '',
    name: 'Sara',
    phone: '',
    email: '',
    note: '',
    pay: 0,
    items: [
      { id: 'a', qty: 2, sel: {}, name: 'Flat white', opts: 'Large', unit: 600, total: 1200, cat: 'drinks', station: 'bar' },
      { id: 'b', qty: 1, sel: {}, name: 'Club sandwich', opts: '', unit: 450, total: 450, cat: 'kitchen', station: 'kitchen', note: 'no nuts, peanut allergy' },
    ],
    totals: { sub: 1650, discount: 0, promo: 0, reward: 0, fee: 0, rate: 0.16, tax: 264, total: 1914 },
    promoCode: '',
    pickupAt: { t: 0, tomorrow: false },
    status: 'accepted',
    stations: { bar: 'queued', kitchen: 'queued' },
    events: [],
    messages: [],
    readByCafe: 0,
    rider: null,
    paid: { t: 1, by: 'Ayesha', byId: 'u1', method: 0, tendered: 2000, change: 86 },
    source: 'counter',
    takenBy: null,
    customerId: null,
    key: 'secret-key',
    club: null,
    ...over,
  }) as ServerOrder;

const biz = { ...DEFAULT_BUSINESS, name: 'brewns coffee house', ntn: '1234567-8', strn: 'PRA-998877', address: 'MM Alam Road, Lahore', phone: '042 111 222' };
const line = (note: string, name = 'Latte') => ({ id: 'a', qty: 1, sel: {}, name, opts: '', unit: 1, total: 1, cat: 'drinks', station: 'bar' as const, note });

describe('receiptHtml', () => {
  const html = receiptHtml(order(), biz, { cashier: 'Ayesha' });

  it('reads as a sales tax invoice with the registration numbers', () => {
    expect(html).toContain('SALES TAX INVOICE');
    expect(html).toContain('NTN 1234567-8');
    expect(html).toContain('PRA-998877');
    expect(html).toContain(invoiceNumber(order()));
  });

  it('shows each line, the tax at its rate, and the total', () => {
    expect(html).toContain('2 x Flat white');
    expect(html).toContain('Sales tax 16%');
    expect(html).toContain('Rs 264');
    expect(html).toContain('Rs 1,914');
  });

  it('shows the cash received and the change', () => {
    expect(html).toContain('Cash received');
    expect(html).toContain('Rs 2,000');
    expect(html).toContain('Rs 86');
  });

  it('says card or wallet on the 5% line, and shows the approval code', () => {
    const card = receiptHtml(order({ totals: { sub: 1650, discount: 0, promo: 0, reward: 0, fee: 0, rate: 0.05, tax: 83, total: 1733 }, paid: { t: 1, by: 'Ayesha', method: 1, ref: '482915' } }), biz);
    expect(card).toContain('Sales tax 5% (card / wallet)');
    expect(card).toContain('Approval code');
    expect(card).toContain('482915');
    expect(card).not.toContain('Cash received');
  });

  it('marks an unpaid order and a reprint', () => {
    expect(receiptHtml(order({ paid: null }), biz)).toContain('NOT YET PAID');
    expect(receiptHtml(order(), biz, { reprint: true })).toContain('COPY');
  });

  it('never prints the secret tracking key of the customer', () => {
    expect(html).not.toContain('secret-key');
  });

  it('keeps anything a person typed from becoming markup', () => {
    const evil = receiptHtml(order({ name: '<img src=x onerror=alert(1)>', items: [line('"><b>hi', '<script>x()</script>')] }), { ...biz, name: '<b>Evil & Co</b>' });
    expect(evil).not.toContain('<script>x()');
    expect(evil).not.toContain('<img src=x');
    expect(evil).not.toContain('<b>Evil');
    expect(evil).toContain('&lt;script&gt;');
    expect(evil).toContain('Evil &amp; Co');
  });
});

describe('kitchenSlipHtml', () => {
  const html = kitchenSlipHtml(order());

  it('puts the order number big and lists what to make', () => {
    expect(html).toContain('#00123');
    expect(html).toContain('2 x Flat white');
    expect(html).toContain('PICKUP');
  });

  it('flags an allergy request so it cannot be missed', () => {
    expect(html).toContain('ALLERGY');
    expect(kitchenSlipHtml(order({ items: [line('extra hot')] }))).not.toContain('ALLERGY');
  });

  it('says which table', () => {
    expect(kitchenSlipHtml(order({ mode: 'dinein', table: 7 }))).toContain('TABLE 7');
  });

  it('carries no money', () => {
    expect(html).not.toContain('Rs ');
  });
});

describe('tillSlipHtml', () => {
  it('shows what should be in the drawer', () => {
    const html = tillSlipHtml(biz, { cashier: 'Ayesha', day: '2026-03-04', orders: 12, cash: 18000, card: 9000, wallet: 3000, refundsCash: 500, float: 5000, drawer: 22500 });
    expect(html).toContain('Rs 22,500');
    expect(html).toContain('Cash refunds paid');
  });
});

describe('esc', () => {
  it('escapes the five characters that matter', () => {
    expect(esc('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
    expect(esc(null)).toBe('');
  });
});
