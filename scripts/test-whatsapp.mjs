// Test WhatsApp notification formatting and direct links
import { createRequire } from 'module';

function formatPakistaniMobileForWa(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return '92' + digits.slice(1);
  if (/^923\d{9}$/.test(digits)) return digits;
  if (/^\+923\d{9}$/.test(digits)) return digits.replace('+', '');
  if (/^3\d{9}$/.test(digits)) return '92' + digits;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

const COUNTER_MAP_LINKS = {
  0: {
    name: 'MM Alam Road, Gulberg III',
    mapsUrl: 'https://maps.google.com/?q=Brewns+Coffee+MM+Alam+Gulberg+Lahore',
    address: '92 MM Alam Rd, Block C 2 Gulberg III, Lahore, Punjab 54000',
  },
  1: {
    name: 'DHA Phase 5 (Civic Sector)',
    mapsUrl: 'https://maps.google.com/?q=Brewns+Roastery+DHA+Phase+5+Lahore',
    address: 'Sector C Commercial, DHA Phase 5, Lahore, Punjab 54792',
  },
  2: {
    name: 'Johar Town (Emporium District)',
    mapsUrl: 'https://maps.google.com/?q=Brewns+Espresso+Bar+Johar+Town+Lahore',
    address: 'Main Boulevard, Phase 2 Johar Town, Lahore, Punjab 54770',
  },
};

function buildBookingWhatsappMessage(opts) {
  const counter = COUNTER_MAP_LINKS[opts.loc ?? 0] || COUNTER_MAP_LINKS[0];
  const kind = opts.kind === 'party' ? 'EXECUTIVE SUITE / PRIVATE GATHERING' : 'TABLE RESERVATION';
  const guestsLabel = `${opts.guests} Guest${opts.guests === 1 ? '' : 's'}`;
  const areaLabel = opts.area ? ` (${opts.area})` : '';

  return [
    `☕ *BREWNS SPECIALTY ROASTERY & COFFEE BAR*`,
    `*OFFICIAL BOOKING VOUCHER · ${opts.code}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Dear *${opts.name}*, your ${kind.toLowerCase()} is confirmed:`,
    ``,
    `📅 *Date:* ${opts.date}`,
    `⏰ *Time:* ${opts.time}`,
    `👥 *Party:* ${guestsLabel}${areaLabel}`,
    `📍 *Branch:* ${counter.name}`,
    `📌 *Address:* ${counter.address}`,
    ``,
    `🗺️ *Google Maps Counter Directions:*`,
    `${counter.mapsUrl}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✨ *Guest Privileges:*`,
    `• Your table is held for 15 minutes past scheduled time.`,
    `• Single-origin pour-over and artisan espresso calibration ready on arrival.`,
    `• Show this digital pass or voucher code *#${opts.code}* at the concierge desk.`,
    ``,
    `📞 *Direct Concierge Line:* +92 42 3575 8899`,
    `🌐 *Online Portal:* https://brewns-clean.vercel.app`,
  ].join('\n');
}

function getWhatsappDirectLink(phone, message) {
  const formatted = formatPakistaniMobileForWa(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

// Tests
console.log('Testing Pakistani mobile formatting:');
console.assert(formatPakistaniMobileForWa('0300 1234567') === '923001234567', 'Test 1 failed');
console.assert(formatPakistaniMobileForWa('+92 321 9876543') === '923219876543', 'Test 2 failed');
console.assert(formatPakistaniMobileForWa('0345-1112233') === '923451112233', 'Test 3 failed');
console.assert(formatPakistaniMobileForWa('3334445566') === '923334445566', 'Test 4 failed');
console.log('Mobile formatting tests passed!');

const msg = buildBookingWhatsappMessage({
  code: 'BRW-9021',
  name: 'Hamza Malik',
  guests: 4,
  date: '2026-09-30',
  time: '8:30 PM',
  area: 'Mezzanine Roastery View',
  loc: 0,
});
console.log('Sample WhatsApp Voucher:\n---\n' + msg + '\n---');
const link = getWhatsappDirectLink('0300 1234567', msg);
console.log('WhatsApp Direct Link:\n' + link);
console.assert(link && link.startsWith('https://wa.me/923001234567?text='), 'Direct link generation failed');
console.log('All tests passed successfully!');
