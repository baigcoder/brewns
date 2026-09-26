/* End-to-end check of accounts and access control against a running server.

   Start the server on an empty store, then run this:
     BREWNS_DATA_FILE=/tmp/brewns-test.json bun run dev
     node scripts/test-access.mjs            # or BASE=http://localhost:3000

   It creates the owner, invites one of each role, has a customer order, and
   walks the order through the café, checking at every step that each role can
   do its own job and is refused everything else. Exits non-zero on the first
   surprise. Needs a fresh store: it signs up the first owner. */

const BASE = process.env.BASE || 'http://localhost:3000';
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.log(`  ✗ ${msg}`);
  }
};

/** A browser with its own cookies. */
function agent(name) {
  const jar = new Map();
  return {
    name,
    async call(method, path, body) {
      const res = await fetch(BASE + path, {
        method,
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const c of res.headers.getSetCookie?.() || []) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const k = pair.slice(0, i), v = pair.slice(i + 1);
        if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k);
        else jar.set(k, v);
      }
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data, location: res.headers.get('location') };
    },
    get(p) {
      return this.call('GET', p);
    },
    post(p, b = {}) {
      return this.call('POST', p, b);
    },
  };
}

const step = (t) => console.log(`\n${t}`);
const pkMin = () => {
  const d = new Date(Date.now() + 5 * 3600000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const open = pkMin() >= 7 * 60 && pkMin() + 12 <= 21 * 60;
const when = open ? 'asap' : { t: 10 * 60, tomorrow: pkMin() >= 10 * 60 - 12 };

const owner = agent('owner');
const team = {};

step('Owner sign-up');
{
  const r = await owner.post('/api/auth/owner-signup', { name: 'Hassan Baig', email: 'owner@brewns.test', password: 'coffee123' });
  ok(r.status === 200, `first owner created (${r.status} ${r.data.error || ''})`);
  const again = await agent('x').post('/api/auth/owner-signup', { name: 'Someone Else', email: 'x@brewns.test', password: 'coffee123' });
  ok(again.status === 409, 'a second owner cannot sign up (409)');
  const status = await agent('x').get('/api/public/status');
  ok(status.data.live === true, 'the site now sends orders to the console');
}

step('Invites, one per role');
for (const role of ['manager', 'cashier', 'barista', 'chef', 'waiter', 'rider']) {
  const r = await owner.post('/api/staff/users', { name: `Test ${role}`, email: `${role}@brewns.test`, role, shops: role === 'rider' ? [0] : [], plate: role === 'rider' ? 'LEB 1234' : '' });
  ok(r.status === 201 && r.data.link, `owner invited a ${role}`);
  const token = r.data.link.split('/').pop();
  const a = agent(role);
  const pre = await a.post('/api/auth/signin', { kind: 'staff', email: `${role}@brewns.test`, password: 'whatever1' });
  ok(pre.status === 401, `${role} can't sign in before setting a password`);
  const j = await a.post('/api/auth/invite', { token, password: 'brewns123' });
  ok(j.status === 200, `${role} joined, lands on ${j.data.next}`);
  const reuse = await agent('x').post('/api/auth/invite', { token, password: 'brewns123' });
  ok(reuse.status === 404, `${role}'s invite link works only once`);
  team[role] = a;
}

step('Who can open what');
const matrix = [
  ['/api/staff/reports', { owner: 200, manager: 200, cashier: 403, barista: 403, chef: 403, waiter: 403, rider: 403 }],
  ['/api/staff/users', { owner: 200, manager: 200, cashier: 403, chef: 403, rider: 403 }],
  ['/api/staff/access', { owner: 200, manager: 403, cashier: 403 }],
  ['/api/staff/audit', { owner: 200, manager: 200, waiter: 403 }],
  ['/api/staff/orders', { owner: 200, cashier: 200, chef: 403, waiter: 403, rider: 403 }],
  ['/api/staff/customers', { owner: 200, manager: 200, cashier: 403 }],
  ['/api/staff/promos', { owner: 200, manager: 200, cashier: 403, barista: 403 }],
];
for (const [path, want] of matrix)
  for (const [role, code] of Object.entries(want)) {
    const r = await (role === 'owner' ? owner : team[role]).get(path);
    ok(r.status === code, `${role} → ${path}: ${r.status} (want ${code})`);
  }
{
  const anon = await agent('x').get('/api/staff/live');
  ok(anon.status === 401, 'no session → 401 on the live board');
  const page = await agent('x').get('/dashboard/overview');
  ok(page.status === 307 && page.location?.includes('/staff/signin'), 'console pages send strangers to sign in');
}

step('Team rules');
{
  const m = team.manager;
  const r1 = await m.post('/api/staff/users', { name: 'Another Manager', email: 'm2@brewns.test', role: 'manager' });
  ok(r1.status === 403, 'a manager cannot invite another manager');
  const r2 = await m.post('/api/staff/users', { name: 'New Waiter', email: 'w2@brewns.test', role: 'waiter' });
  ok(r2.status === 201, 'a manager can invite a waiter');
  const list = (await owner.get('/api/staff/users')).data.team;
  const me = list.find((u) => u.role === 'owner');
  const r3 = await owner.post(`/api/staff/users/${me.id}`, { role: 'manager' });
  ok(r3.status === 403, "the owner can't change their own role");
  const r4 = await m.post(`/api/staff/users/${me.id}`, { active: false });
  ok(r4.status === 403, "a manager can't switch the owner off");
  const r5 = await m.post('/api/staff/access', { role: 'chef', perm: 'reports.view', on: true });
  ok(r5.status === 403, "a manager can't change the access matrix");
  const r6 = await owner.post('/api/staff/access', { role: 'manager', perm: 'access.manage', on: true });
  ok(r6.status === 400, 'access control itself stays with owners');
}

step('A customer orders online');
const customer = agent('customer');
let order, key;
{
  const s = await customer.post('/api/account/signup', { name: 'Ayesha Khan', email: 'ayesha@brewns.test', phone: '0300 1234567', password: 'latte1234' });
  ok(s.status === 200, 'customer account created');
  const j = await customer.post('/api/account/club', { action: 'join', birthday: '' });
  ok(j.data.club?.member && j.data.club.stamps === 1, 'joined the club: welcome stamp on the card');
  const bad = await customer.post('/api/orders', { items: [{ id: 'latte', qty: 1, sel: { size: 9 } }], mode: 'pickup', loc: 0, when, name: 'Ayesha', phone: '03001234567', pay: 0 });
  ok(bad.status === 400, 'an option that does not exist is refused');
  const r = await customer.post('/api/orders', {
    items: [
      { id: 'latte', qty: 2, sel: { size: 1, milk: 1, temp: 0 } },
      { id: 'smash-burger', qty: 1, sel: { meal: 0, extra: 0 } },
    ],
    mode: 'pickup',
    loc: 0,
    when,
    name: 'Ayesha Khan',
    phone: '0300 1234567',
    pay: 1,
    promo: 'BREWNS10',
    totals: { total: 1 }, // ignored: the server prices it
  });
  ok(r.status === 201, `order placed (${r.status} ${r.data.error || ''})`);
  order = r.data.order;
  key = r.data.key;
  const sub = 2 * (950 + 150) + 1350;
  const expect = sub - Math.round(sub * 0.1) + Math.round((sub - Math.round(sub * 0.1)) * 0.05);
  ok(order.totals.total === expect, `priced on the server: Rs ${order.totals.total} (want ${expect})`);
  ok(r.data.club?.stamps === 2, `club stamps for two drinks: ${r.data.club?.stamps}`);
  const t = await agent('x').get(`/api/orders/${order.number}?k=${key}`);
  ok(t.status === 200 && t.data.order.stage === 'accepted', `tracking works with the key (stage ${t.data.order?.stage})`);
  const t2 = await agent('x').get(`/api/orders/${order.number}?k=wrong`);
  ok(t2.status === 404, 'tracking without the right key → 404');
  const mine = await customer.get('/api/account/orders');
  ok(mine.data.orders?.length === 1, 'the order is in the customer’s history');
}

step('The kitchen');
{
  const chefLive = (await team.chef.get('/api/staff/live')).data;
  const ticket = chefLive.orders.find((o) => o.number === order.number);
  ok(!!ticket, 'the chef sees the ticket');
  ok(ticket && !ticket.phone && !ticket.key, 'the chef does not see the phone number or tracking key');
  const r1 = await team.chef.post(`/api/staff/orders/${order.number}`, { type: 'station', station: 'bar', state: 'making' });
  ok(r1.status === 403, "the chef can't bump the bar's ticket");
  const r2 = await team.chef.post(`/api/staff/orders/${order.number}`, { type: 'station', station: 'kitchen', state: 'making' });
  ok(r2.status === 200 && r2.data.order.status === 'preparing', 'chef starts the burger → order is making');
  const cancel = await customer.post(`/api/orders/${order.number}`, { k: key, type: 'cancel' });
  ok(cancel.status === 409, 'the customer can no longer cancel once it is being made');
  await team.chef.post(`/api/staff/orders/${order.number}`, { type: 'station', station: 'kitchen', state: 'done' });
  const r3 = await team.barista.post(`/api/staff/orders/${order.number}`, { type: 'station', station: 'bar', state: 'done' });
  ok(r3.data.order?.status === 'ready', 'barista finishes the lattes → the order is ready');
  const r4 = await team.waiter.post(`/api/staff/orders/${order.number}`, { type: 'collected' });
  ok(r4.status === 403, "a waiter can't hand over a pickup");
  const m = await customer.post(`/api/orders/${order.number}`, { k: key, type: 'message', text: 'Is it ready?' });
  ok(m.status === 200, 'the customer messages the café');
  const reply = await team.chef.post(`/api/staff/orders/${order.number}`, { type: 'message', text: 'Yes!' });
  ok(reply.status === 403, "the chef can't message customers");
  const reply2 = await team.cashier.post(`/api/staff/orders/${order.number}`, { type: 'message', text: 'Yes, at the counter!' });
  ok(reply2.status === 200, 'the cashier replies');
  const r5 = await team.cashier.post(`/api/staff/orders/${order.number}`, { type: 'collected' });
  ok(r5.data.order?.status === 'collected' && r5.data.order.paid, 'the cashier hands it over, paid');
  const t = await customer.get(`/api/orders/${order.number}?k=${key}`);
  ok(t.data.order.stage === 'collected' && t.data.order.messages.some((x) => x.from === 'cafe'), 'the customer sees collected and the reply');
}

step('A table order and a waiter call');
{
  const r = await team.waiter.post('/api/staff/orders', { items: [{ id: 'cortado', qty: 1, sel: { shots: 0, milk: 0, temp: 0 } }], mode: 'dinein', loc: 0, table: 4, pay: 0 });
  ok(r.status === 201, 'the waiter rings up table 4');
  const n = r.data.order.number;
  const call = await agent('guest').post('/api/tables/call', { loc: 0, table: 4, kind: 'bill' });
  ok(call.status === 200, 'table 4 asks for the bill from their phone');
  const live = (await team.waiter.get('/api/staff/live')).data;
  ok(live.calls.some((c) => c.table === 4 && c.kind === 'bill'), 'the waiter sees the call');
  await team.barista.post(`/api/staff/orders/${n}`, { type: 'station', station: 'bar', state: 'done' });
  const s = await team.waiter.post(`/api/staff/orders/${n}`, { type: 'served' });
  ok(s.data.order?.status === 'served', 'the waiter serves it');
  const p = await team.waiter.post(`/api/staff/orders/${n}`, { type: 'paid', method: 1 });
  ok(p.data.order?.paid?.method === 1, 'the waiter takes payment by card');
  const a = await team.waiter.post('/api/staff/calls', { id: '0-4-bill' });
  ok(a.status === 200, 'the call is answered');
}

step('A delivery');
{
  const guest = agent('guest');
  const r = await guest.post('/api/orders', { items: [{ id: 'fajita-pizza', qty: 1, sel: { size: 1, crust: 0 } }], mode: 'delivery', area: 0, loc: 0, when, name: 'Bilal', phone: '0321 7654321', address: 'House 12, Street 4, Gulberg III', pay: 0 });
  ok(r.status === 201, 'a guest orders a delivery');
  const n = r.data.order.number;
  const riderLive = (await team.rider.get('/api/staff/live')).data;
  const d = riderLive.orders.find((o) => o.number === n);
  ok(d && !d.phone, 'the rider sees the delivery, but not the phone until it is theirs');
  const early = await team.rider.post(`/api/staff/orders/${n}`, { type: 'pickup' });
  ok(early.status === 403 || early.status === 409, `the rider can't leave with an order that isn't theirs (${early.status})`);
  const take = await team.rider.post(`/api/staff/orders/${n}`, { type: 'take' });
  ok(take.status === 200 && take.data.order.phone, 'the rider takes it and now sees the phone and address');
  const t = await guest.get(`/api/orders/${n}?k=${r.data.key}`);
  ok(t.data.order.stage === 'rider' && t.data.order.rider?.plate === 'LEB 1234', 'the customer sees their rider and bike');
  await team.chef.post(`/api/staff/orders/${n}`, { type: 'station', station: 'kitchen', state: 'done' });
  const go = await team.rider.post(`/api/staff/orders/${n}`, { type: 'pickup' });
  ok(go.data.order?.status === 'onway', 'on the road');
  const done = await team.rider.post(`/api/staff/orders/${n}`, { type: 'delivered' });
  ok(done.data.order?.status === 'delivered' && done.data.order.paid, 'delivered, cash collected');
}

step('Changing access takes effect at once');
{
  const before = await team.chef.get('/api/staff/orders');
  ok(before.status === 403, 'the chef cannot see order history');
  await owner.post('/api/staff/access', { role: 'chef', perm: 'orders.view', on: true });
  const after = await team.chef.get('/api/staff/orders');
  ok(after.status === 200, 'the owner ticks "See every order" for chefs: the chef can now');
  await owner.post('/api/staff/access', { reset: 'chef' });
  const reset = await team.chef.get('/api/staff/orders');
  ok(reset.status === 403, 'reset to defaults: refused again');

  const list = (await owner.get('/api/staff/users')).data.team;
  const waiter = list.find((u) => u.email === 'waiter@brewns.test');
  await owner.post(`/api/staff/users/${waiter.id}`, { active: false });
  const off = await team.waiter.get('/api/staff/live');
  ok(off.status === 401, 'a switched-off waiter is signed out on their next request');
  const cashier = list.find((u) => u.email === 'cashier@brewns.test');
  await owner.post(`/api/staff/users/${cashier.id}`, { role: 'barista' });
  const demoted = await team.cashier.get('/api/staff/orders');
  ok(demoted.status === 401, 'changing a role ends their old session');
}

step('Reports, sold out and the activity log');
{
  const rep = (await owner.get('/api/staff/reports?range=today')).data;
  ok(rep.kpis.orders >= 3, `today: ${rep.kpis.orders} orders, Rs ${rep.kpis.gross}`);
  await team.chef.post('/api/staff/menu', { id: 'smash-burger', out: true });
  const status = (await agent('x').get('/api/public/status')).data;
  ok(status.soldOut.includes('smash-burger'), 'the chef marks the burger sold out; the site knows');
  const r = await customer.post('/api/orders', { items: [{ id: 'smash-burger', qty: 1, sel: { meal: 0, extra: 0 } }], mode: 'pickup', loc: 0, when, name: 'Ayesha', phone: '03001234567', pay: 0 });
  ok(r.status === 409, 'and it can no longer be ordered');
  const log = (await owner.get('/api/staff/audit')).data.entries;
  ok(log.some((e) => /sold out/i.test(e.action)) && log.some((e) => /Invited/.test(e.action)), `activity log has ${log.length} entries`);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
