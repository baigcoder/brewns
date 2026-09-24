/**
 * What happens after an order is placed: its stages and their times, the
 * rider, the conversation with the café, and the receipt.
 *
 * There is no backend yet, so the flow runs on the clock from the moment the
 * order was placed. Every stage has a real time: a pickup is ready at its
 * pickup time, a delivery arrives at its delivery time, and the stages in
 * between are spread over the real preparation and riding time. `ff`
 * fast-forwards the same flow for a preview. When a backend exists, only
 * `timeline()` needs to read the café's real status instead of the clock.
 */

export type Order = {
  number: number;
  placed: number;
  target: number;
  mode: 'pickup' | 'delivery';
  loc: number;
  area: number | null;
  address: string;
  name: string;
  phone: string;
  note: string;
  pay: number;
  items: { id: string; qty: number; sel: Record<string, number> }[];
  totals: { sub: number; discount: number; fee: number; rate: number; tax: number; total: number };
  pickupAt: { t: number; tomorrow: boolean };
  ff?: { at: number; v: number; speed: number };
  cancelled?: number;
  collected?: number;
};

export type Stage = { key: string; label: string; detail: string; at: number };

export const PREP_MS = 12 * 60000;

/** The clock the order runs on: real time, or fast-forwarded for a preview. */
export const orderNow = (o: Order, now = Date.now()) => (o.ff ? o.ff.v + (now - o.ff.at) * o.ff.speed : now);

/** Fast-forward from here: the rest of the flow plays out in about a minute. */
export function fastForward(o: Order, now = Date.now()) {
  const v = orderNow(o, now);
  o.ff = { at: now, v, speed: Math.max(1, (o.target + 60000 - v) / 60000) };
}

const RIDERS = [
  ['Ahmed Raza', 'LEB 21 4471'],
  ['Bilal Hussain', 'LEC 19 0932'],
  ['Usman Tariq', 'LEA 22 7718'],
  ['Hamza Iqbal', 'LED 20 3356'],
  ['Zain Abbas', 'LEB 23 5820'],
];
export const riderFor = (o: Order) => {
  const [name, plate] = RIDERS[o.number % RIDERS.length];
  return { name, first: name.split(' ')[0], plate, rating: (4.7 + ((o.number * 7) % 3) / 10).toFixed(1) };
};

/**
 * The stages with their times. A scheduled order waits, then runs the same
 * flow backwards from its time; an ASAP order starts straight away.
 */
export function timeline(o: Order, shopName: string): Stage[] {
  const lead = o.target - o.placed;
  const accepted = o.placed + Math.min(45000, lead * 0.05);
  if (o.mode === 'delivery') {
    // Prep and ride take at most 45 minutes, so a delivery booked for later
    // waits at "accepted" and then runs the same flow up to its time.
    const span = Math.min(lead, 45 * 60000);
    const start = o.target - span;
    const at = (f: number) => Math.max(accepted + 1, start + span * f);
    const r = riderFor(o);
    return [
      { key: 'received', label: 'ORDER RECEIVED', detail: 'Sent to the café', at: o.placed },
      { key: 'accepted', label: 'ACCEPTED', detail: `${shopName} has it`, at: accepted },
      { key: 'preparing', label: 'PREPARING', detail: 'Being made fresh', at: at(0.1) },
      { key: 'rider', label: 'RIDER ASSIGNED', detail: `${r.first} · ${r.plate}`, at: at(0.35) },
      { key: 'onway', label: 'OUT FOR DELIVERY', detail: 'Picked up, on the road', at: at(0.5) },
      { key: 'arriving', label: 'ARRIVING', detail: 'Nearly at your door', at: at(0.9) },
      { key: 'delivered', label: 'DELIVERED', detail: 'Enjoy', at: o.target },
    ];
  }
  const prep = Math.min(PREP_MS, lead);
  return [
    { key: 'received', label: 'ORDER RECEIVED', detail: 'Sent to the café', at: o.placed },
    { key: 'accepted', label: 'ACCEPTED', detail: `${shopName} has it`, at: accepted },
    { key: 'preparing', label: 'BARISTA ON IT', detail: 'Being made fresh', at: Math.max(accepted + 1, o.target - prep * 0.85) },
    { key: 'ready', label: 'READY FOR COLLECTION', detail: 'At the pickup counter', at: o.target },
    { key: 'collected', label: 'COLLECTED', detail: 'Enjoy', at: o.collected || o.target + 15 * 60000 },
  ];
}

/** Where the order is now: the index of the last stage reached. */
export function currentStage(o: Order, stages: Stage[], now = Date.now()) {
  const t = orderNow(o, now);
  let i = 0;
  stages.forEach((s, k) => {
    if (t >= s.at) i = k;
  });
  return i;
}

/** How far along the rider is between the shop and the door, 0–1. */
export function riderProgress(o: Order, stages: Stage[], now = Date.now()) {
  if (o.mode !== 'delivery') return 0;
  const t = orderNow(o, now);
  const from = stages.find((s) => s.key === 'onway')!.at;
  return Math.max(0, Math.min(1, (t - from) / Math.max(1, o.target - from)));
}

export const canCancel = (o: Order, stages: Stage[], now = Date.now()) =>
  !o.cancelled && currentStage(o, stages, now) < stages.findIndex((s) => s.key === 'preparing');

/* ── messages ── */

export type Message = { from: 'you' | 'cafe' | 'rider' | 'system'; text: string; t: number };

/** What the café or rider says on their own when a stage is reached. */
export function stageMessage(o: Order, key: string, shopName: string): Message | null {
  const first = o.name.split(' ')[0];
  const r = riderFor(o);
  const says: Record<string, [Message['from'], string]> = {
    accepted: ['cafe', `Hi ${first}! ${shopName} here. We've got order #${String(o.number).padStart(5, '0')} and we're on it.`],
    preparing: ['cafe', 'Your order is being made now.'],
    ready: ['cafe', `It's ready at the pickup counter. Show #${String(o.number).padStart(5, '0')} and it's yours.`],
    rider: ['rider', `Assalam o alaikum, this is ${r.first}. I'll be collecting your order from ${shopName}.`],
    onway: ['rider', `Picked up and on my way. Bike ${r.plate}.`],
    arriving: ['rider', `About 3 minutes away. I'll call ${o.phone} when I'm outside.`],
    delivered: ['rider', 'Delivered. Enjoy, and thank you!'],
  };
  const m = says[key];
  return m ? { from: m[0], text: m[1], t: 0 } : null;
}

/** A reply to a message, from whoever is handling the order at that moment. */
export function autoReply(o: Order, text: string, stages: Stage[], shopName: string, now = Date.now()): Message {
  const i = currentStage(o, stages, now);
  const key = stages[i].key;
  const onRoad = o.mode === 'delivery' && i >= stages.findIndex((s) => s.key === 'onway');
  const from: Message['from'] = onRoad ? 'rider' : 'cafe';
  const left = Math.max(0, Math.ceil((o.target - orderNow(o, now)) / 60000));
  const q = text.toLowerCase();
  const made = i >= stages.findIndex((s) => s.key === (o.mode === 'delivery' ? 'onway' : 'ready'));
  const say = (s: string): Message => ({ from, text: s, t: now });
  if (o.cancelled) return say('This order was cancelled. Place a new one any time.');
  if (/where|status|how long|late|eta|kab|kitna|kitni/.test(q))
    return say(left ? `It's at "${stages[i].label.toLowerCase()}". About ${left} min ${o.mode === 'delivery' ? 'to your door' : 'until it’s ready'}.` : o.mode === 'delivery' ? "It's been delivered. Enjoy!" : "It's ready at the pickup counter now.");
  if (/cancel/.test(q))
    return say(i < stages.findIndex((s) => s.key === 'preparing') ? 'You can still cancel: tap CANCEL ORDER below.' : `Sorry, it's already being made, so we can't cancel now. Call ${shopName} if something's wrong.`);
  if (/napkin|tissue|sauce|ketchup|straw|spoon|fork|cutlery/.test(q)) return say(made ? "It's packed already, but I'll bring extra from the bag." : "Noted, we'll pack it in.");
  if (/sugar|hot|ice|oat|almond|decaf|spicy|mild|less|extra|no /.test(q))
    return say(key === 'received' || key === 'accepted' ? "Noted for the barista, we'll make it that way." : made ? "Sorry, it's already made. Tell us at the counter and we'll sort it out." : "Passing it to the barista now. If it's too late we'll make it right at the counter.");
  if (/gate|call|outside|address|house|floor|flat|block|street|landmark/.test(q) && o.mode === 'delivery') return say(`Got it. I'll call ${o.phone} when I reach you.`);
  if (/thank|shukriya|jazak/.test(q)) return say('Anytime! Enjoy ☕');
  if (/^(hi|hello|salam|aoa|assalam)/.test(q)) return say(`Hi ${o.name.split(' ')[0]}! How can we help with your order?`);
  return say(`Thanks, ${from === 'rider' ? 'noted' : `${shopName} has your message`}. We'll reply here if we need anything.`);
}

export const QUICK_REPLIES = {
  pickup: ['Where is my order?', 'Less sugar please', 'Extra napkins', 'Can I cancel?'],
  delivery: ['Where is my order?', 'Call me when outside', 'Extra napkins', 'Leave at the gate'],
};

/* ── receipt ── */

export type ReceiptLine = { qty: number; name: string; opts: string; unit: number; total: number };

export const invoiceNo = (o: Order, branch: string) => `BRW-${branch}-${String(o.number).padStart(6, '0')}`;

/** A WhatsApp message to the café with the order in it. */
export function whatsappText(o: Order, lines: ReceiptLine[], money: (n: number) => string, where: string, when: string) {
  const num = String(o.number).padStart(5, '0');
  return [
    `Assalam o alaikum brewns! This is ${o.name} about order #${num}.`,
    '',
    ...lines.map((l) => `• ${l.qty} × ${l.name}${l.opts ? ` (${l.opts})` : ''}: ${money(l.total)}`),
    '',
    `Total: ${money(o.totals.total)}`,
    `${o.mode === 'delivery' ? 'Delivery to' : 'Pickup at'}: ${where}`,
    `Time: ${when}`,
  ].join('\n');
}
