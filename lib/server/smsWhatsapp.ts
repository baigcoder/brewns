import { kv, withLock } from './store';
import { LOC_TITLES } from '@/lib/catalog';
import { bumpLive } from './orders';
import type { Reservation } from '@/app/api/reservations/route';
import type { PartyBooking } from './voiceCall';

export interface BookingNotificationPayload {
  code: string;
  name: string;
  phone: string;
  email?: string;
  loc: number;
  date: string;
  time: string;
  guests: number;
  area?: string;
  occasion?: string;
  kind?: 'table' | 'party';
}

export const COUNTER_MAP_LINKS: Record<number, { name: string; address: string; mapUrl: string }> = {
  0: {
    name: 'Flagship Roastery · MM Alam Road',
    address: 'MM Alam Road, Block B2, Gulberg III, Lahore',
    mapUrl: 'https://maps.google.com/?q=Brewns+Specialty+Coffee+MM+Alam+Road+Gulberg+Lahore',
  },
  1: {
    name: 'CCA Counter · DHA Phase 5',
    address: 'CCA Commercial Area, Sector C, DHA Phase 5, Lahore',
    mapUrl: 'https://maps.google.com/?q=Brewns+Specialty+Coffee+CCA+DHA+Phase+5+Lahore',
  },
  2: {
    name: 'Roast & Brew Bar · Johar Town',
    address: 'Main Boulevard, Phase 1, Johar Town, Lahore',
    mapUrl: 'https://maps.google.com/?q=Brewns+Specialty+Coffee+Main+Boulevard+Johar+Town+Lahore',
  },
};

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

/** Convert Pakistani phone number e.g. "0300 1234567" into international WhatsApp number format "923001234567" */
export function formatPakistaniMobileForWa(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) return digits;
  if (digits.startsWith('03') && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.startsWith('3') && digits.length === 10) return `92${digits}`;
  return digits.length >= 10 ? digits : `92${digits}`;
}

/** Formats an executive, luxury WhatsApp booking voucher with Google Maps link */
export function buildBookingWhatsappMessage(p: BookingNotificationPayload): string {
  const counter = COUNTER_MAP_LINKS[p.loc] || COUNTER_MAP_LINKS[0];
  const dateStr = formatSpokenDate(p.date);
  const timeStr = formatSpokenTime(p.time);
  const isParty = p.kind === 'party';

  return [
    `☕ *BREWNS SPECIALTY COFFEE HOUSE · LAHORE*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✨ *${isParty ? 'PARTY & EVENT BOOKING' : 'TABLE RESERVATION'} CONFIRMED*`,
    ``,
    `Booking Code: *${p.code}*`,
    `Guest Name: *${p.name}*`,
    `Party Size: *${p.guests} Guests*`,
    `Seating Area: *${(p.area || 'Indoor').toUpperCase()}*`,
    ``,
    `📍 *Location:* ${counter.name}`,
    `📫 *Address:* ${counter.address}`,
    `🗓 *Date:* ${dateStr}`,
    `⏰ *Time:* ${timeStr}`,
    ``,
    `🗺️ *Google Maps Live Directions:*`,
    `${counter.mapUrl}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💡 *Host Desk Note:* Please share your code *${p.code}* or name upon arrival. Your table will be ready.`,
    ``,
    `Need to reschedule? Reply directly to this WhatsApp message or call our concierge line.`,
    `We look forward to hosting you!`,
  ].join('\n');
}

/** Generates a 1-click WhatsApp deep link so customer/staff can open the voucher instantly */
export function getWhatsappDirectLink(phone: string, text: string): string {
  const waPhone = formatPakistaniMobileForWa(phone);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export interface SendWhatsappResult {
  ok: boolean;
  sentVia: 'twilio' | 'meta_cloud' | 'local_record';
  whatsappUrl: string;
  error?: string;
}

/** Dispatch booking voucher to WhatsApp / SMS and record in store & live dashboard */
export async function sendBookingWhatsappNotification(
  payload: BookingNotificationPayload,
): Promise<SendWhatsappResult> {
  const waPhone = formatPakistaniMobileForWa(payload.phone);
  const text = buildBookingWhatsappMessage(payload);
  const directLink = getWhatsappDirectLink(payload.phone, text);
  const now = Date.now();
  let sentVia: SendWhatsappResult['sentVia'] = 'local_record';

  // 1. If Twilio WhatsApp credentials are configured, send real message
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (twilioSid && twilioAuth) {
    try {
      const basic = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const body = new URLSearchParams({
        From: twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`,
        To: `whatsapp:+${waPhone}`,
        Body: text,
      });

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        sentVia = 'twilio';
      } else {
        const errText = await res.text();
        console.warn('[Twilio WhatsApp Error]', errText);
      }
    } catch (e: any) {
      console.warn('[Twilio WhatsApp Catch]', e.message);
    }
  }

  // 2. Persist record to KV store so owner/staff dashboard and system can always inspect it
  try {
    const record = {
      code: payload.code,
      phone: payload.phone,
      waPhone,
      name: payload.name,
      loc: payload.loc,
      date: payload.date,
      time: payload.time,
      guests: payload.guests,
      sentAt: sentVia !== 'local_record' ? now : undefined,
      recordedAt: now,
      sentVia,
      status: sentVia === 'local_record' ? 'ready_to_share' : 'sent',
      whatsappUrl: directLink,
      text,
    };

    await kv.hset('whatsapp_notifications', payload.code, record);
    await kv.hset('sent_whatsapp', `${payload.code}_${now}`, record);

    // Update reservation with WhatsApp dispatch status
    await withLock('reservations', async () => {
      const all = (await kv.hall<Reservation>('reservations')) || {};
      const target = Object.values(all).find((r) => r.code === payload.code || (r.phone === payload.phone && r.date === payload.date));
      if (target) {
        (target as any).whatsappSent = sentVia !== 'local_record';
        if (sentVia !== 'local_record') (target as any).whatsappSentAt = now;
        (target as any).whatsappUrl = directLink;
        await kv.hset('reservations', target.id, target);
      }
    });

    // Also update party bookings if party
    if (payload.kind === 'party') {
      await withLock('party_bookings', async () => {
        const all = (await kv.hall<PartyBooking>('party_bookings')) || {};
        const target = Object.values(all).find((p) => p.code === payload.code);
        if (target) {
          (target as any).whatsappSent = sentVia !== 'local_record';
          if (sentVia !== 'local_record') (target as any).whatsappSentAt = now;
          (target as any).whatsappUrl = directLink;
          await kv.hset('party_bookings', target.id, target);
        }
      });
    }

    // Trigger live dashboard update
    await bumpLive();

    console.info(`[WhatsApp Notification] Queued & recorded voucher for ${payload.code} to ${waPhone} via ${sentVia}`);
    return { ok: true, sentVia, whatsappUrl: directLink };
  } catch (err: any) {
    console.error('[WhatsApp Notification Store Error]', err);
    return { ok: false, sentVia, whatsappUrl: directLink, error: err.message };
  }
}
