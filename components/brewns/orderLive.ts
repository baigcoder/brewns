/**
 * What happens after an order is placed: its stages and their times, the
 * rider, the conversation with the café, and the receipt.
 *
 * An order placed on the server (`o.server`) follows the café's real status:
 * the stage staff set on the console, when each stage was reached, the rider
 * they assigned and the messages they sent. Stages not reached yet show the
 * expected time.
 *
 * Without a server (a fresh install before the owner has signed up) the flow
 * runs on the clock from the moment the order was placed, as a preview: a
 * pickup is ready at its pickup time, a delivery arrives at its delivery time,
 * and `ff` fast-forwards it.
 */

export type Order = {
  number: number;
  placed: number;
  target: number;
  mode: 'pickup' | 'delivery' | 'dinein';
  /** The table a dine-in order goes to (from the table's QR code). */
  table?: number | null;
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
  /** The café's own record of the order, refreshed from /api/orders/<number>. */
  server?: ServerView;
};

export type ServerView = {
  /** The customer's tracking key: the password for this order's status and messages. */
  key: string;
  stage: string;
  status: string;
  times: Record<string, number>;
  rider: { name: string; plate: string } | null;
  messages: { id: string; from: 'you' | 'cafe' | 'rider'; text: string; t: number; by?: string }[];
  cancelled: { t: number; reason: string } | null;
  /** When the tracker last heard from the server. */
  checked: number;
};

export type Stage = { key: string; label: string; detail: string; at: number };

/** The stage that ends an order: delivered, collected, or served at the table. */
export const finalStage = (o: Pick<Order, 'mode'>) => (o.mode === 'delivery' ? 'delivered' : o.mode === 'dinein' ? 'served' : 'collected');

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
  if (o.server) {
    const r = o.server.rider;
    if (!r) return { name: 'Your rider', first: 'Rider', plate: '', rating: '' };
    return { name: r.name, first: r.name.split(' ')[0], plate: r.plate, rating: '' };
  }
  const [name, plate] = RIDERS[o.number % RIDERS.length];
  return { name, first: name.split(' ')[0], plate, rating: (4.7 + ((o.number * 7) % 3) / 10).toFixed(1) };
};

/**
 * The stages with their times. A scheduled order waits, then runs the same
 * flow backwards from its time; an ASAP order starts straight away.
 */
export function timeline(o: Order, shopName: string): Stage[] {
  const stages = clockTimeline(o, shopName);
  if (!o.server) return stages;
  // Reached stages carry the time the café actually reached them.
  return stages.map((s) => (s.key in o.server!.times ? { ...s, at: o.server!.times[s.key] } : s));
}

function clockTimeline(o: Order, shopName: string): Stage[] {
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
      { key: 'rider', label: 'RIDER ASSIGNED', detail: r.plate ? `${r.first} · ${r.plate}` : 'Picked just before it’s ready', at: at(0.35) },
      { key: 'onway', label: 'OUT FOR DELIVERY', detail: 'Picked up, on the road', at: at(0.5) },
      { key: 'arriving', label: 'ARRIVING', detail: 'Nearly at your door', at: at(0.9) },
      { key: 'delivered', label: 'DELIVERED', detail: 'Enjoy', at: o.target },
    ];
  }
  const prep = Math.min(PREP_MS, lead);
  if (o.mode === 'dinein')
    return [
      { key: 'received', label: 'ORDER RECEIVED', detail: `Table ${o.table ?? ''}`.trim(), at: o.placed },
      { key: 'accepted', label: 'ACCEPTED', detail: `${shopName} has it`, at: accepted },
      { key: 'preparing', label: 'BEING MADE', detail: 'Made fresh for your table', at: Math.max(accepted + 1, o.target - prep * 0.85) },
      { key: 'ready', label: 'ON ITS WAY', detail: 'Coming to your table', at: o.target },
      { key: 'served', label: 'SERVED', detail: 'Enjoy', at: o.target + 2 * 60000 },
    ];
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
  if (o.server) {
    const at = stages.findIndex((s) => s.key === o.server!.stage);
    if (at >= 0) return at;
    // Cancelled (or a stage this view doesn't show): the last one reached.
    let last = 0;
    stages.forEach((s, k) => {
      if (s.key in o.server!.times) last = k;
    });
    return last;
  }
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
  if (o.server) {
    const stage = o.server.stage;
    if (stage === 'delivered') return 1;
    if (stage !== 'onway' && stage !== 'arriving') return 0;
    // No GPS: estimate from when the rider left against the promised time, and
    // never show "at the door" until the rider says so.
    const from = o.server.times.onway ?? now;
    const est = (now - from) / Math.max(60000, o.target - from);
    return Math.max(stage === 'arriving' ? 0.85 : 0.02, Math.min(stage === 'arriving' ? 0.97 : 0.85, est));
  }
  const t = orderNow(o, now);
  const from = stages.find((s) => s.key === 'onway')!.at;
  return Math.max(0, Math.min(1, (t - from) / Math.max(1, o.target - from)));
}

export const canCancel = (o: Order, stages: Stage[], now = Date.now()) =>
  o.server
    ? !o.server.cancelled && (o.server.status === 'received' || o.server.status === 'accepted')
    : !o.cancelled && currentStage(o, stages, now) < stages.findIndex((s) => s.key === 'preparing');

/* ── messages ── */

export type Message = { from: 'you' | 'cafe' | 'rider' | 'system'; text: string; t: number };

/** What the café or rider says on their own when a stage is reached. */
export function stageMessage(o: Order, key: string, shopName: string): Message | null {
  const first = o.name.split(' ')[0];
  const r = riderFor(o);
  const says: Record<string, [Message['from'], string]> = {
    accepted: ['cafe', `Hi ${first}! ${shopName} here. We've got order #${String(o.number).padStart(5, '0')} and we're on it.`],
    preparing: ['cafe', 'Your order is being made now.'],
    ready: o.mode === 'dinein' ? ['cafe', `It's ready and on its way to table ${o.table ?? ''}.`] : ['cafe', `It's ready at the pickup counter. Show #${String(o.number).padStart(5, '0')} and it's yours.`],
    served: ['cafe', 'Enjoy! Message us here if you need anything at the table.'],
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
  dinein: ['Where is my order?', 'Extra napkins', 'Less sugar please', 'Can we get water?'],
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
