/* The printed bill and the kitchen slip, as small self-contained HTML documents
   (80 mm thermal paper). Nothing here touches the page it is printed from: the
   console loads the document into a hidden frame and prints that frame.

   Every piece of text that came from a person is escaped. */

import { LOC_TITLES, PAY, SHOP_CODES } from './catalog';
import { MODE_LABEL, isAllergyNote, orderNo, type ServerOrder } from './orderFlow';

/** An order as the console holds it: everything but the customer's secret key. */
export type Printable = Omit<ServerOrder, 'key'>;

export type Business = { name: string; address: string; phone: string; ntn: string; strn: string; footer: string };

export const DEFAULT_BUSINESS: Business = { name: 'brewns coffee house', address: '', phone: '', ntn: '', strn: '', footer: 'Thank you for visiting brewns!' };

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;
export const invoiceNumber = (o: Pick<ServerOrder, 'number' | 'loc'>) => `BRW-${SHOP_CODES[o.loc] ?? 'XXX'}-${String(o.number).padStart(6, '0')}`;

const when = (t: number) =>
  new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const PAGE = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:80mm auto;margin:3mm}
*{box-sizing:border-box}
body{margin:0;width:74mm;font:12px/1.35 'Courier New',ui-monospace,monospace;color:#000}
h1{font-size:15px;margin:0;text-align:center;letter-spacing:.02em}
.c{text-align:center}.r{text-align:right}.b{font-weight:700}.s{font-size:10.5px}
.hr{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;gap:8px}
.row>span:first-child{min-width:0}
.big{font-size:26px;font-weight:700;text-align:center;letter-spacing:.04em}
.note{font-size:10.5px;padding-left:12px}
.warn{font-weight:700;border:1px solid #000;padding:0 3px}
</style></head><body>${body}</body></html>`;

/** The customer's bill: a sales-tax invoice with the way it was paid. */
export function receiptHtml(o: Printable, biz: Business, opts: { cashier?: string; reprint?: boolean } = {}): string {
  const t = o.totals;
  const method = o.paid ? PAY[o.paid.method]?.[0] : null;
  const where = o.mode === 'dinein' ? `Table ${o.table}` : o.mode === 'delivery' ? `Delivery · ${o.address}` : 'Counter pickup';
  const lines = o.items
    .map((l) => `<div class="row"><span>${l.qty} x ${esc(l.name)}${l.opts ? ` <span class="s">(${esc(l.opts)})</span>` : ''}</span><span>${esc(rs(l.total))}</span></div>${l.note ? `<div class="note">“${esc(l.note)}”</div>` : ''}`)
    .join('');
  const body = `
<h1>${esc(biz.name)}</h1>
<div class="c s">${esc(LOC_TITLES[o.loc] || '')}${biz.address ? `<br>${esc(biz.address)}` : ''}${biz.phone ? `<br>Tel ${esc(biz.phone)}` : ''}</div>
${biz.ntn || biz.strn ? `<div class="c s">${biz.ntn ? `NTN ${esc(biz.ntn)}` : ''}${biz.ntn && biz.strn ? ' · ' : ''}${biz.strn ? `Sales tax reg. ${esc(biz.strn)}` : ''}</div>` : ''}
<div class="hr"></div>
<div class="c b">SALES TAX INVOICE${opts.reprint ? ' · COPY' : ''}</div>
<div class="row s"><span>Invoice</span><span>${esc(invoiceNumber(o))}</span></div>
<div class="row s"><span>Date</span><span>${esc(when(o.placed))}</span></div>
<div class="row s"><span>Order</span><span>${esc(orderNo(o.number))} · ${esc(MODE_LABEL[o.mode])}</span></div>
<div class="row s"><span>For</span><span>${esc(where)}</span></div>
${o.name && o.name !== 'Walk-in' ? `<div class="row s"><span>Customer</span><span>${esc(o.name)}</span></div>` : ''}
${opts.cashier || o.paid?.by ? `<div class="row s"><span>Cashier</span><span>${esc(opts.cashier || o.paid?.by)}</span></div>` : ''}
<div class="hr"></div>
${lines}
<div class="hr"></div>
<div class="row"><span>Subtotal</span><span>${esc(rs(t.sub))}</span></div>
${t.discount ? `<div class="row"><span>Discount${o.promoCode ? ` (${esc(o.promoCode)})` : ''}</span><span>-${esc(rs(t.discount))}</span></div>` : ''}
${t.fee ? `<div class="row"><span>Delivery</span><span>${esc(rs(t.fee))}</span></div>` : ''}
<div class="row"><span>Sales tax ${Math.round(t.rate * 100)}%${t.rate < 0.1 ? ' (card / wallet)' : ''}</span><span>${esc(rs(t.tax))}</span></div>
<div class="hr"></div>
<div class="row b" style="font-size:15px"><span>TOTAL</span><span>${esc(rs(t.total))}</span></div>
<div class="hr"></div>
${
  o.paid
    ? `<div class="row"><span>Paid by</span><span>${esc(method)}</span></div>
${o.paid.tendered !== undefined ? `<div class="row"><span>Cash received</span><span>${esc(rs(o.paid.tendered))}</span></div><div class="row b"><span>Change</span><span>${esc(rs(o.paid.change ?? 0))}</span></div>` : ''}
${o.paid.ref ? `<div class="row s"><span>${o.paid.method === 1 ? 'Approval code' : 'Transaction ID'}</span><span>${esc(o.paid.ref)}</span></div>` : ''}`
    : `<div class="c b">NOT YET PAID</div>`
}
<div class="hr"></div>
<div class="c s">${esc(biz.footer)}</div>
<div class="c s">Prices in PKR. Sales tax is shown separately.</div>`;
  return PAGE(`${invoiceNumber(o)}`, body);
}

/** The slip for the kitchen: big order number, where it goes, what to make, and any allergy flagged. */
export function kitchenSlipHtml(o: Printable): string {
  const where = o.mode === 'dinein' ? `TABLE ${o.table}` : o.mode === 'delivery' ? 'DELIVERY' : 'PICKUP';
  const lines = o.items
    .map(
      (l) =>
        `<div class="b" style="font-size:14px;margin-top:5px">${l.qty} x ${esc(l.name)}</div>${l.opts ? `<div class="note">${esc(l.opts)}</div>` : ''}${l.note ? `<div class="note b">${isAllergyNote(l.note) ? '<span class="warn">ALLERGY</span> ' : ''}“${esc(l.note)}”</div>` : ''}`,
    )
    .join('');
  const body = `
<div class="big">${esc(orderNo(o.number))}</div>
<div class="c b" style="font-size:16px">${esc(where)}</div>
<div class="c s">${esc(LOC_TITLES[o.loc] || '')} · ${esc(when(o.placed))}</div>
<div class="hr"></div>
${lines}
${o.note ? `<div class="hr"></div><div class="b">NOTE: ${esc(o.note)}</div>` : ''}
<div class="hr"></div>
<div class="c s">${o.name && o.name !== 'Walk-in' ? esc(o.name) : ''}</div>`;
  return PAGE(`Kitchen ${orderNo(o.number)}`, body);
}

/** The cashier's end-of-shift slip. */
export function tillSlipHtml(biz: Business, t: { cashier: string; day: string; orders: number; cash: number; card: number; wallet: number; refundsCash: number; float: number; drawer: number }): string {
  const row = (a: string, b: number | string, bold = false) => `<div class="row${bold ? ' b' : ''}"><span>${esc(a)}</span><span>${esc(typeof b === 'number' ? rs(b) : b)}</span></div>`;
  return PAGE(
    'Till report',
    `<h1>${esc(biz.name)}</h1><div class="c b">TILL REPORT</div><div class="c s">${esc(t.cashier)} · ${esc(t.day)}</div><div class="hr"></div>
${row('Orders', String(t.orders))}${row('Cash sales', t.cash)}${row('Card sales', t.card)}${row('Wallet sales', t.wallet)}
${t.refundsCash ? row('Cash refunds paid', -t.refundsCash) : ''}<div class="hr"></div>
${row('Opening float', t.float)}${row('Cash that should be in the drawer', t.drawer, true)}<div class="hr"></div><div class="c s">Count the drawer and compare.</div>`,
  );
}
