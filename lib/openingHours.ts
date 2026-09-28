import { CLOSE_MIN, OPEN_MIN } from '@/lib/catalog';

export const CAFE_TIME_ZONE = 'Asia/Karachi';

export type CafeOpeningStatus = {
  isOpen: boolean;
  isBeforeOpening: boolean;
  isSeatingOpen: boolean;
  minuteOfDay: number;
  minutesToChange: number;
  nextChange: 'opens' | 'closes';
  todayTime: string;
  closeTime: string;
};

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${suffix}`;
}

/** Business status using the café's local timezone, regardless of caller timezone. */
export function getCafeOpeningStatus(now: Date = new Date()): CafeOpeningStatus {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAFE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const minuteOfDay = hour * 60 + minute;
  const isOpen = minuteOfDay >= OPEN_MIN && minuteOfDay < CLOSE_MIN;
  const isBeforeOpening = minuteOfDay < OPEN_MIN;
  const nextChange = isOpen ? 'closes' : 'opens';
  const boundary = isOpen ? CLOSE_MIN : OPEN_MIN;
  const minutesToChange = isOpen
    ? boundary - minuteOfDay
    : isBeforeOpening
      ? boundary - minuteOfDay
      : 24 * 60 - minuteOfDay + boundary;

  return {
    isOpen,
    isBeforeOpening,
    isSeatingOpen: isOpen && minuteOfDay < CLOSE_MIN - 60,
    minuteOfDay,
    minutesToChange,
    nextChange,
    todayTime: formatClock(OPEN_MIN),
    closeTime: formatClock(CLOSE_MIN),
  };
}

export function cafeHoursStatusLabel(status: CafeOpeningStatus, lang: 'en' | 'ur' = 'en'): string {
  if (lang === 'ur') {
    if (!status.isOpen) return status.isBeforeOpening ? 'بند · آج صبح 7 بجے کھلے گا' : 'بند · کل صبح 7 بجے کھلے گا';
    return status.isSeatingOpen ? 'کھلا · رات 9 بجے تک' : 'کھلا · پک اپ رات 9 بجے تک';
  }
  if (!status.isOpen) return status.isBeforeOpening ? 'CLOSED · OPENS TODAY AT 7 AM' : 'CLOSED · OPENS TOMORROW AT 7 AM';
  return status.isSeatingOpen ? 'OPEN · UNTIL 9 PM' : 'OPEN · PICKUP UNTIL 9 PM';
}

export function cafeHoursReply(status: CafeOpeningStatus, lang: 'en' | 'ur' = 'en'): string {
  if (lang === 'ur') {
    if (!status.isOpen) {
      return status.isBeforeOpening
        ? 'ہم اس وقت بند ہیں، لیکن آج صبح 7 بجے کھل جائیں گے اور رات 9 بجے تک کھلے رہیں گے۔ کیا میں آپ کے لیے بعد کا آرڈر یا بکنگ تیار کروں؟'
        : 'ہم اس وقت بند ہیں۔ کل صبح 7 بجے دوبارہ کھلیں گے اور رات 9 بجے تک کھلے رہیں گے۔ کیا میں کل کے لیے کوئی انتظام کر دوں؟';
    }
    if (!status.isSeatingOpen) return 'ہم ابھی کھلے ہیں اور رات 9 بجے بند ہوں گے، البتہ آج بیٹھنے اور کچن کی سروس رات 8 بجے تک ہے۔ کیا میں کسی اور چیز میں مدد کروں؟';
    return 'جی، ہم ابھی کھلے ہیں اور رات 9 بجے بند ہوں گے۔ بیٹھنے اور کچن کی سروس رات 8 بجے تک ہے۔ کیا میں آپ کے لیے ٹیبل دیکھوں؟';
  }
  if (!status.isOpen) {
    return status.isBeforeOpening
      ? `We’re closed right now. We open today at ${status.todayTime} and stay open until ${status.closeTime}. Would you like help planning a later visit?`
      : `We’re closed right now. We reopen tomorrow at ${status.todayTime} and stay open until ${status.closeTime}. Would you like help planning a visit?`;
  }
  if (!status.isSeatingOpen) return `We’re open now until ${status.closeTime}, but seating and kitchen service ended at 8 PM today. Can I help with anything else?`;
  return `Yes, we’re open now until ${status.closeTime}. Seating and kitchen service run until 8 PM. Would you like me to help with a table?`;
}
