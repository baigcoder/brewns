import nodemailer, { type Transporter } from 'nodemailer';
import { kv, withLock } from './store';
import { LOC_TITLES } from '@/lib/catalog';
import type { Reservation } from '@/app/api/reservations/route';
import type { PartyBooking } from './voiceCall';

export interface BookingEmailPayload {
  code: string;
  name: string;
  email: string;
  phone: string;
  loc: number;
  date: string;
  time: string;
  guests: number;
  area?: string;
  occasion?: string;
  notes?: string;
  kind?: 'table' | 'party';
}

const formatSpokenDate = (iso: string) => {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
};

const formatSpokenTime = (hm: string) => {
  if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return hm;
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char] as string);

export function renderBookingEmailHtml(p: BookingEmailPayload): string {
  const counterName = LOC_TITLES[p.loc] || 'MM Alam Road · Gulberg III';
  const displayDate = formatSpokenDate(p.date);
  const displayTime = formatSpokenTime(p.time);
  const isParty = p.kind === 'party';
  const title = isParty ? 'Party & Event Booking' : 'Table Reservation';
  const code = escapeHtml(p.code);
  const name = escapeHtml(p.name);
  const phone = escapeHtml(p.phone);
  const email = escapeHtml(p.email);
  const guests = escapeHtml(p.guests);
  const area = escapeHtml(p.area?.toUpperCase());
  const occasion = escapeHtml(p.occasion);
  const notes = escapeHtml(p.notes);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Booking at brewns — ${code}</title>
</head>
<body style="margin:0; padding:0; background-color:#0d0c0a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f5ede3; -webkit-font-smoothing:antialiased;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your reservation ${code} at brewns coffee house is confirmed for ${escapeHtml(displayDate)} at ${escapeHtml(displayTime)}.
  </div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0d0c0a; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px; background-color:#161412; border:1px solid rgba(255,255,255,0.08); border-radius:18px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.6);">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.06); background:radial-gradient(100% 120% at 50% 0%, rgba(201,147,85,0.15), transparent 70%);">
              <p style="margin:0 0 10px; font-family:monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#c99355;">// BREWNS COFFEE HOUSE · LAHORE</p>
              <h1 style="margin:0; font-size:26px; font-weight:700; letter-spacing:-0.02em; color:#ffffff; text-transform:uppercase;">${title} Confirmed</h1>
              <div style="display:inline-block; margin-top:14px; padding:6px 16px; border-radius:9999px; background:rgba(201,147,85,0.12); border:1px solid rgba(201,147,85,0.35); font-family:monospace; font-size:15px; font-weight:700; letter-spacing:0.1em; color:#e0a868;">
                ${code}
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 16px;">
              <p style="margin:0 0 12px; font-size:16px; line-height:1.5; color:#f5ede3;">
                Hi <b>${name}</b>,
              </p>
              <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(245,237,227,0.78);">
                We're excited to host you at brewns. Your ${isParty ? 'event' : 'table'} is confirmed and reserved for you. Simply mention your name or code <b>${code}</b> when you arrive.
              </p>
            </td>
          </tr>

          <!-- Booking Summary Card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#1c1916; border:1px solid rgba(201,147,85,0.22); border-radius:12px; padding:20px;">
                <tr>
                  <td style="padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">LOCATION</span>
                    <span style="font-size:15px; font-weight:600; color:#ffffff;">${counterName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">DATE &amp; TIME</span>
                    <span style="font-size:15px; font-weight:600; color:#e0a868;">${escapeHtml(displayDate)} · ${escapeHtml(displayTime)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">PARTY SIZE</span>
                    <span style="font-size:15px; font-weight:600; color:#ffffff;">${guests} Guests${p.area ? ` · ${area} SEATING` : ''}${p.occasion ? ` · ${occasion}` : ''}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">CONTACT</span>
                    <span style="font-size:14px; color:rgba(245,237,227,0.85);">${phone} · ${email}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notes -->
          ${p.notes ? `
          <tr>
            <td style="padding:0 32px 20px;">
              <p style="margin:0; font-family:monospace; font-size:12px; line-height:1.5; color:rgba(245,237,227,0.5);">
                <b>Notes:</b> ${notes}
              </p>
            </td>
          </tr>` : ''}

          <!-- Footer Information -->
          <tr>
            <td style="padding:24px 32px 32px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="margin:0 0 10px; font-size:13px; color:rgba(245,237,227,0.6); line-height:1.5;">
                Need to modify your reservation or running late?<br>
                Reply directly to this email or call our front desk directly at <b>brewns</b>.
              </p>
              <p style="margin:16px 0 0; font-family:monospace; font-size:11px; letter-spacing:0.06em; color:rgba(245,237,227,0.35); text-transform:uppercase;">
                brewns coffee house · MM Alam · DHA · Johar Town · Lahore
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderBookingEmailText(p: BookingEmailPayload): string {
  const counterName = LOC_TITLES[p.loc] || 'MM Alam Road · Gulberg III';
  const displayDate = formatSpokenDate(p.date);
  const displayTime = formatSpokenTime(p.time);
  const isParty = p.kind === 'party';

  return `BREWNS COFFEE HOUSE · LAHORE
${isParty ? 'PARTY & EVENT BOOKING' : 'TABLE RESERVATION'} CONFIRMED

Hi ${p.name},

Your booking is confirmed! Details below:

Confirmation Code: ${p.code}
Location: ${counterName}
Date & Time: ${displayDate} at ${displayTime}
Guests: ${p.guests}${p.area ? ` (${p.area} seating)` : ''}${p.occasion ? ` (${p.occasion})` : ''}
Contact: ${p.name} · ${p.phone} · ${p.email}
${p.notes ? `Notes: ${p.notes}\n` : ''}
Simply mention your name or code ${p.code} when you arrive.
Need to change or cancel? Reply to this email or call brewns front desk.

brewns coffee house · Lahore
Open daily 07:00–21:00
`;
}

export async function sendBookingConfirmationEmail(payload: BookingEmailPayload): Promise<{ ok: boolean; error?: string; sentVia: string }> {
  if (!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email.trim())) {
    return { ok: false, error: 'Invalid recipient email address.', sentVia: 'local_record' };
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const subject = `Your Booking at brewns is Confirmed — ${payload.code}`;
  const html = renderBookingEmailHtml({ ...payload, email: cleanEmail });
  const text = renderBookingEmailText({ ...payload, email: cleanEmail });
  const now = Date.now();

  const sent = await sendEmail({ to: cleanEmail, subject, text, html });
  const sentVia = sent.ok ? sent.sentVia : 'local_record';

  // 2. Persist record to KV store so owner/staff dashboard and system can always inspect it
  try {
    const record = {
      code: payload.code,
      email: cleanEmail,
      name: payload.name,
      phone: payload.phone,
      loc: payload.loc,
      date: payload.date,
      time: payload.time,
      guests: payload.guests,
      sentAt: now,
      sentVia,
      subject,
    };

    await kv.hset('reservation_emails', payload.code, record);
    await kv.hset('sent_emails', `${payload.code}_${now}`, record);

    // Also update the reservation in kv if it exists
    await withLock('reservations', async () => {
      const all = (await kv.hall<Reservation>('reservations')) || {};
      const target = Object.values(all).find((r) => r.code === payload.code || (r.phone === payload.phone && r.date === payload.date));
      if (target) {
        target.email = cleanEmail;
        target.emailSent = sentVia !== 'local_record';
        if (target.emailSent) target.emailSentAt = now;
        await kv.hset('reservations', target.id, target);
      }
    });

    // Also associate in party bookings if it was a party
    if (payload.kind === 'party') {
      await withLock('party_bookings', async () => {
        const all = (await kv.hall<PartyBooking>('party_bookings')) || {};
        const target = Object.values(all).find((p) => p.code === payload.code);
        if (target) {
          target.email = cleanEmail;
          target.emailSent = sentVia !== 'local_record';
          if (target.emailSent) target.emailSentAt = now;
          await kv.hset('party_bookings', target.id, target);
        }
      });
    }

    console.info(`[Email Confirmation] Successfully queued & recorded confirmation for ${payload.code} to ${cleanEmail} via ${sentVia}`);
    return { ok: true, sentVia };
  } catch (err: any) {
    console.error('[Email Store Error]', err);
    return { ok: false, error: err.message, sentVia };
  }
}

/* Gmail (or any SMTP mailbox) through Nodemailer: no domain needed, mail comes from a real
   inbox so it lands in the inbox, about 500 a day on a free Gmail. SMTP_USER is the address,
   SMTP_PASS a Google "App password" (Google Account → Security → App passwords). */
let smtp: Transporter | null = null;
const smtpTransport = () => {
  const user = process.env.SMTP_USER?.trim(), pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return (smtp ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    // a serverless request can't wait on a stuck mail server
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  }));
};

/**
 * Sends one email through whichever provider is set up: SMTP (Gmail), then Resend, then Brevo.
 * Returns how it went; with none configured nothing is sent and `sentVia` is "none".
 */
export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<{ ok: boolean; sentVia: 'smtp' | 'resend' | 'brevo' | 'none' }> {
  const to = msg.to.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, sentVia: 'none' };
  const html = msg.html || `<pre style="font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap">${msg.text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)}</pre>`;

  const mailer = smtpTransport();
  if (mailer) {
    try {
      await mailer.sendMail({
        from: { name: 'brewns', address: process.env.SMTP_USER!.trim() },
        to,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
        subject: msg.subject,
        text: msg.text,
        html,
      });
      return { ok: true, sentVia: 'smtp' };
    } catch (e) {
      console.warn('[Email SMTP Error]', (e as Error).message);
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'brewns <onboarding@resend.dev>',
          to: [to],
          reply_to: process.env.EMAIL_REPLY_TO || 'brewns.coffee@gmail.com',
          subject: msg.subject,
          html,
          text: msg.text,
        }),
      });
      if (res.ok) return { ok: true, sentVia: 'resend' };
      console.warn('[Email Resend Error]', await res.text().catch(() => ''));
    } catch (e) {
      console.warn('[Email Resend Catch]', (e as Error).message);
    }
  }

  const brevoKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { name: 'brewns', email: process.env.EMAIL_FROM || 'orders@brewns.coffee' }, to: [{ email: to }], subject: msg.subject, htmlContent: html, textContent: msg.text }),
      });
      if (res.ok) return { ok: true, sentVia: 'brevo' };
      console.warn('[Email Brevo Error]', await res.text().catch(() => ''));
    } catch (e) {
      console.warn('[Email Brevo Catch]', (e as Error).message);
    }
  }
  return { ok: false, sentVia: 'none' };
}

const escHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * A short branded email with one button: staff invites, new links and password resets.
 * Inline styles and tables only, so it looks the same in Gmail, Outlook and phone mail apps.
 */
export function renderLinkEmail(p: { preview: string; heading: string; lines: string[]; button: string; link: string; note: string; signoff?: string }): string {
  const para = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b342c;">${escHtml(t)}</p>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(p.heading)}</title></head>
<body style="margin:0;padding:0;background:#f2f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escHtml(p.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f0ea;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4dfd4;">
<tr><td style="background:#17130f;padding:22px 28px;"><span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#f4f1ea;">brewns</span><span style="font-size:11px;letter-spacing:2px;color:#d8b777;padding-left:10px;">COFFEE HOUSE · LAHORE</span></td></tr>
<tr><td style="padding:30px 28px 8px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#17130f;">${escHtml(p.heading)}</h1>
${p.lines.map(para).join('')}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 18px;"><tr><td style="border-radius:8px;background:#d8b777;">
<a href="${escHtml(p.link)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#17130f;text-decoration:none;border-radius:8px;">${escHtml(p.button)}</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:12px;color:#8a8278;">Button not working? Paste this into your browser:</p>
<p style="margin:0 0 20px;font-size:12px;word-break:break-all;"><a href="${escHtml(p.link)}" style="color:#9a7a3c;">${escHtml(p.link)}</a></p>
<p style="margin:0 0 24px;padding:12px 14px;border-radius:8px;background:#f7f4ee;font-size:13px;line-height:1.5;color:#5b5348;">${escHtml(p.note)}</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #efeae0;font-size:13px;line-height:1.6;color:#8a8278;">${escHtml(p.signoff || 'brewns coffee house')}<br>MM Alam Road · CCA DHA Phase 5 · Johar Town, Lahore</td></tr>
</table></td></tr></table></body></html>`;
}
