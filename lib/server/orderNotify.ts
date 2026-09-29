/* Tells the customer where their order stands, from the server, so it reaches
   them with the tab closed: a WhatsApp message (Twilio) and, if they gave an
   address, an email (Resend or Brevo). Without credentials nothing is sent;
   the message is only recorded (`order_notifications`) so the café can see it.

   One message per milestone, never for demo orders, and never allowed to fail
   an order: `notifyOrder` swallows every error. */

import { LOC_TITLES, pkMobile } from '@/lib/catalog';
import { clock, orderNo, type ServerOrder, type Status } from '@/lib/orderFlow';
import { formatPakistaniMobileForWa } from './smsWhatsapp';
import { kv } from './store';

/** The milestones a customer is told about. */
export const NOTIFY_ON: readonly Status[] = ['received', 'ready', 'onway', 'delivered', 'cancelled'];

/** What to say when an order reaches `status`, or null when that step is silent. */
export function orderMessage(o: Pick<ServerOrder, 'number' | 'mode' | 'status' | 'name' | 'loc' | 'target' | 'rider' | 'cancelReason' | 'table'>, status: Status = o.status): { subject: string; text: string } | null {
  if (!NOTIFY_ON.includes(status)) return null;
  const no = orderNo(o.number);
  const first = o.name.split(' ')[0] || 'there';
  const shop = LOC_TITLES[o.loc] || 'brewns';
  let text: string;
  switch (status) {
    case 'received':
      text = `Thanks ${first}, we have order ${no}. ${o.mode === 'dinein' ? `It's coming to table ${o.table}.` : `It should be ${o.mode === 'delivery' ? 'with you' : 'ready'} around ${clock(o.target)}.`}`;
      break;
    case 'ready':
      if (o.mode === 'dinein') return null;
      text = o.mode === 'delivery' ? `Order ${no} is packed and waiting for the rider.` : `Order ${no} is ready. Collect it at brewns ${shop}.`;
      break;
    case 'onway':
      text = `Order ${no} is on its way${o.rider ? ` with ${o.rider.name}` : ''}.`;
      break;
    case 'delivered':
      text = `Order ${no} has been delivered. Enjoy, ${first}!`;
      break;
    default:
      text = `Order ${no} was cancelled${o.cancelReason ? `: ${o.cancelReason}` : ''}. If that's a surprise, please call brewns ${shop}.`;
  }
  return { subject: `brewns · order ${no}`, text: `☕ brewns · ${text}` };
}

async function whatsapp(phone: string, text: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth || !pkMobile(phone)) return false;
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`, To: `whatsapp:+${formatPakistaniMobileForWa(phone)}`, Body: text }).toString(),
    signal: AbortSignal.timeout(4000),
  });
  return res.ok;
}

async function email(to: string, subject: string, text: string): Promise<boolean> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const resend = process.env.RESEND_API_KEY;
  if (resend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'brewns <onboarding@resend.dev>', to: [to], subject, text }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return true;
  }
  const brevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (brevo) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevo, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { name: 'brewns', email: process.env.EMAIL_FROM || 'orders@brewns.coffee' }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  }
  return false;
}

/** Sends the message for `status` (default: where the order is now) once per status; call it after the order is saved. `before` skips it when nothing moved. */
export async function notifyOrder(o: ServerOrder, before?: Status, status: Status = o.status) {
  try {
    if (o.demo || (before && before === o.status)) return;
    const msg = orderMessage(o, status);
    if (!msg) return;
    if (!(await kv.set(`notified:${o.number}:${status}`, 1, { nx: true, ttlSec: 7 * 86400 }))) return;
    const [wa, mail] = await Promise.all([whatsapp(o.phone, msg.text).catch(() => false), o.email ? email(o.email, msg.subject, msg.text).catch(() => false) : false]);
    await kv.push('order_notifications', { t: Date.now(), order: o.number, status, phone: o.phone, email: o.email, whatsapp: wa, mail, text: msg.text }, 200);
  } catch (e) {
    console.warn('[order notify]', e);
  }
}
