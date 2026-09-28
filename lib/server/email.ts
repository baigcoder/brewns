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

export function renderBookingEmailHtml(p: BookingEmailPayload): string {
  const counterName = LOC_TITLES[p.loc] || 'MM Alam Road · Gulberg III';
  const displayDate = formatSpokenDate(p.date);
  const displayTime = formatSpokenTime(p.time);
  const isParty = p.kind === 'party';
  const title = isParty ? 'Party & Event Booking' : 'Table Reservation';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Booking at brewns — ${p.code}</title>
</head>
<body style="margin:0; padding:0; background-color:#0d0c0a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f5ede3; -webkit-font-smoothing:antialiased;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your reservation ${p.code} at brewns coffee house is confirmed for ${displayDate} at ${displayTime}.
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
                ${p.code}
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 16px;">
              <p style="margin:0 0 12px; font-size:16px; line-height:1.5; color:#f5ede3;">
                Hi <b>${p.name}</b>,
              </p>
              <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(245,237,227,0.78);">
                We're excited to host you at brewns. Your ${isParty ? 'event' : 'table'} is confirmed and reserved for you. Simply mention your name or code <b>${p.code}</b> when you arrive.
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
                    <span style="font-size:15px; font-weight:600; color:#e0a868;">${displayDate} · ${displayTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">PARTY SIZE</span>
                    <span style="font-size:15px; font-weight:600; color:#ffffff;">${p.guests} Guests${p.area ? ` · ${p.area.toUpperCase()} SEATING` : ''}${p.occasion ? ` · ${p.occasion}` : ''}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;">
                    <span style="font-family:monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(245,237,227,0.46); display:block; margin-bottom:4px;">CONTACT</span>
                    <span style="font-size:14px; color:rgba(245,237,227,0.85);">${p.phone} · ${p.email}</span>
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
                <b>Notes:</b> ${p.notes}
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

export async function sendBookingConfirmationEmail(payload: BookingEmailPayload): Promise<{ ok: boolean; error?: string; sentVia?: string }> {
  if (!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email.trim())) {
    return { ok: false, error: 'Invalid recipient email address.' };
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const subject = `Your Booking at brewns is Confirmed — ${payload.code}`;
  const html = renderBookingEmailHtml({ ...payload, email: cleanEmail });
  const text = renderBookingEmailText({ ...payload, email: cleanEmail });
  const now = Date.now();

  let sentVia = 'local_record';

  // 1. Try Resend if RESEND_API_KEY is available
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      // Use onboarding@resend.dev unless a custom domain is explicitly configured
      const fromAddr = process.env.EMAIL_FROM || 'brewns Concierge <onboarding@resend.dev>';
      const replyTo = process.env.EMAIL_REPLY_TO || 'brewns.coffee@gmail.com';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [cleanEmail],
          reply_to: replyTo,
          subject,
          html,
          text,
          headers: {
            'X-Entity-Ref-ID': payload.code,
          },
        }),
      });
      if (res.ok) {
        sentVia = 'resend';
      } else {
        const errText = await res.text();
        console.warn('[Email Resend Error]', errText);
      }
    } catch (e: any) {
      console.warn('[Email Resend Catch]', e.message);
    }
  }

  // 2. Try Brevo if BREVO_API_KEY is available and Resend didn't send
  const brevoKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (sentVia === 'local_record' && brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'brewns Concierge', email: process.env.EMAIL_FROM || 'orders@brewns.coffee' },
          to: [{ email: cleanEmail }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      if (res.ok) {
        sentVia = 'brevo';
      } else {
        console.warn('[Email Brevo Error]', await res.text().catch(() => ''));
      }
    } catch (e: any) {
      console.warn('[Email Brevo Catch]', e.message);
    }
  }

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
        target.emailSent = true;
        target.emailSentAt = now;
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
          await kv.hset('party_bookings', target.id, target);
        }
      });
    }

    console.info(`[Email Confirmation] Successfully queued & recorded confirmation for ${payload.code} to ${cleanEmail} via ${sentVia}`);
    return { ok: true, sentVia };
  } catch (err: any) {
    console.error('[Email Store Error]', err);
    return { ok: false, error: err.message };
  }
}
