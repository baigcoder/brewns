import { currentStaff } from '@/lib/server/auth';
import { clientIp, fail, isEmail, json, rateLimit, readBody, route, str, int } from '@/lib/server/http';
import { kv, withLock } from '@/lib/server/store';
import { pkMobile, SHOP_COUNT } from '@/lib/catalog';

export type Reservation = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  loc: number;
  date: string;
  time: string;
  guests: number;
  area: 'indoor' | 'terrace' | 'bar';
  notes: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled';
  createdAt: number;
};

const makeCode = () => `RES-${Math.floor(1000 + Math.random() * 9000)}`;

/** GET /api/reservations: staff view of table bookings */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const locParam = url.searchParams.get('loc');
  const dateParam = url.searchParams.get('date');

  const all = Object.values(await kv.hall<Reservation>('reservations') || {});
  let list = all.sort((a, b) => b.createdAt - a.createdAt);

  if (locParam !== null && locParam !== 'all') {
    const loc = Number(locParam);
    if (Number.isInteger(loc)) list = list.filter((r) => r.loc === loc);
  }

  if (dateParam) {
    list = list.filter((r) => r.date === dateParam);
  }

  return json({ reservations: list });
});

/** POST /api/reservations: public guest reservation creation */
export const POST = route(async (req) => {
  const b = await readBody(req);
  await rateLimit(`reserve:${clientIp(req)}`, 10, 3600);

  const name = str(b.name, 60).replace(/\s+/g, ' ');
  const email = str(b.email, 120).toLowerCase();
  const rawPhone = str(b.phone, 20);
  const phone = pkMobile(rawPhone) || rawPhone;
  const loc = int(b.loc, 0, SHOP_COUNT - 1) ?? 0;
  const date = str(b.date, 20);
  const time = str(b.time, 20);
  const guests = int(b.guests, 1, 20) ?? 2;
  const areaRaw = str(b.area, 20).toLowerCase();
  const area = areaRaw === 'terrace' || areaRaw === 'bar' ? areaRaw : 'indoor';
  const notes = str(b.notes, 250);

  if (name.length < 2) fail(400, 'Please enter your name.');
  if (!isEmail(email)) fail(400, 'Please provide a valid email address.');
  if (!phone || phone.length < 9) fail(400, 'Please provide a valid contact number.');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'Please pick a valid reservation date.');
  if (!time) fail(400, 'Please select a preferred seating time.');

  const res: Reservation = await withLock('reservations', async () => {
    const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const code = makeCode();
    const item: Reservation = {
      id,
      code,
      name,
      phone,
      email,
      loc,
      date,
      time,
      guests,
      area,
      notes,
      status: 'confirmed',
      createdAt: Date.now(),
    };
    await kv.hset('reservations', id, item);
    return item;
  });

  return json({ ok: true, reservation: res }, 201);
});

/** PATCH /api/reservations: update reservation status (staff) */
export const PATCH = route(async (req) => {
  const ctx = await currentStaff();
  if (!ctx) fail(401, 'Sign in as staff to manage bookings.');

  const b = await readBody(req);
  const id = str(b.id, 60);
  const status = str(b.status, 20) as Reservation['status'];

  if (!['pending', 'confirmed', 'seated', 'cancelled'].includes(status)) {
    fail(400, 'Invalid reservation status.');
  }

  const updated = await withLock('reservations', async () => {
    const item = await kv.hget<Reservation>('reservations', id);
    if (!item) fail(404, 'Reservation not found.');
    const next: Reservation = { ...item!, status };
    await kv.hset('reservations', id, next);
    return next;
  });

  return json({ ok: true, reservation: updated });
});
