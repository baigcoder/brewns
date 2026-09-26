/* Order management engine: order creation with server-side validation,
   state-machine transitions, rider dispatch, customer messaging, waiter calls, and audit logging. */

import { getDb, mutateDb, type Order, type StaffUser, type WaiterCall, type AuditEntry } from './storage';
import { calculateOrderPricing, type OrderItemInput } from '../pricing';
import { OPEN_MIN, CLOSE_MIN, PREP_MIN, DELIVERY, productById } from '../catalog';
import { type OrderAction, validNextActions, type OrderStatus } from '../orderFlow';
import { can, canAny } from '../rbac';

export type CreateOrderInput = {
  items: OrderItemInput[];
  type: 'pickup' | 'delivery' | 'dinein';
  loc: number; // 0, 1, 2
  area?: number | null;
  address?: string;
  table?: string | null;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  pay: number;
  promo?: string | null;
  scheduledSlot?: { t: number; tomorrow: boolean } | null;
  isStaffPos?: boolean;
};

export function createOrder(input: CreateOrderInput, actor?: { id: string; name: string; role: string }): { order?: Order; error?: string } {
  const db = getDb();

  // Validate shop
  const shopSetting = db.shops[input.loc];
  if (!shopSetting) {
    return { error: 'Invalid café location chosen.' };
  }
  if (shopSetting.paused && !input.isStaffPos) {
    return { error: 'This location is temporarily pausing online orders. Please call the shop directly.' };
  }

  // Check opening hours (POS orders and scheduled orders can bypass)
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  if (!input.isStaffPos && !input.scheduledSlot && (currentMin < OPEN_MIN || currentMin + PREP_MIN > CLOSE_MIN)) {
    return { error: 'Our counters are currently closed. We take orders from 07:00 to 21:00.' };
  }

  // Check sold-out items
  for (const it of input.items) {
    if (db.soldOut.includes(it.id)) {
      const p = productById(it.id);
      return { error: `Sorry, "${p?.name || it.id}" is freshly sold out today.` };
    }
  }

  // Promo code validation
  let promoDiscount = 0;
  let activePromoCode: string | null = null;
  if (input.promo) {
    const code = input.promo.trim().toUpperCase();
    const p = db.promos[code];
    if (p && p.active) {
      promoDiscount = p.discountPercent / 100;
      activePromoCode = code;
    }
  }

  const pricing = calculateOrderPricing({
    items: input.items,
    mode: input.type,
    area: input.area,
    pay: input.pay,
    promoDiscount,
  });

  if (!pricing.validItems.length) {
    return { error: 'Your order bag is empty.' };
  }

  if (input.type === 'delivery' && pricing.sub - pricing.discount < DELIVERY.min) {
    return { error: `Delivery minimum is Rs ${DELIVERY.min}.` };
  }

  const seq = (db.orderSeq || 25) + 1;
  const orderId = `BRW-${String(seq).padStart(4, '0')}`;
  const placedTime = Date.now();

  const prepLead = shopSetting.customPrepMin || PREP_MIN;
  const deliveryLead = input.type === 'delivery' && input.area !== undefined && input.area !== null && DELIVERY.areas[input.area]
    ? DELIVERY.areas[input.area][3]
    : prepLead;

  const midnight = new Date(placedTime);
  midnight.setHours(0, 0, 0, 0);
  const targetTime = input.scheduledSlot
    ? midnight.getTime() + (input.scheduledSlot.tomorrow ? 86400000 : 0) + input.scheduledSlot.t * 60000
    : placedTime + deliveryLead * 60000;

  const hasBar = pricing.validItems.some((it) => it.station === 'bar');
  const hasKitchen = pricing.validItems.some((it) => it.station === 'kitchen');

  const newOrder: Order = {
    id: orderId,
    seq,
    placed: placedTime,
    target: targetTime,
    type: input.type,
    loc: input.loc,
    area: input.area ?? null,
    address: input.address?.trim() || '',
    table: input.table?.trim() || null,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || '',
    note: input.note?.trim() || '',
    pay: input.pay,
    paid: input.pay !== 0 || input.isStaffPos === true,
    status: 'placed',
    items: pricing.validItems.map((it) => ({
      ...it,
      done: false,
    })),
    stationStatus: {
      bar: hasBar ? 'pending' : 'ready',
      kitchen: hasKitchen ? 'pending' : 'ready',
    },
    totals: {
      sub: pricing.sub,
      discount: pricing.discount,
      fee: pricing.fee,
      rate: pricing.rate,
      tax: pricing.tax,
      total: pricing.total,
    },
    promo: activePromoCode,
    riderId: null,
    riderName: null,
    riderPhone: null,
    riderPlate: null,
    waiterCall: false,
    messages: [],
    history: [
      {
        action: 'placed',
        actor: actor ? `${actor.name} (${actor.role})` : 'Customer (Online)',
        time: placedTime,
        note: input.isStaffPos ? 'Point-of-Sale walk-in' : 'Online order',
      },
    ],
  };

  mutateDb((d) => {
    d.orderSeq = seq;
    d.orders[orderId] = newOrder;

    // Award club stamp to customer if phone matches an account
    const cleanPhone = input.phone.replace(/\D/g, '');
    for (const cust of Object.values(d.customers)) {
      if (cust.phone.replace(/\D/g, '') === cleanPhone) {
        cust.stamps = (cust.stamps || 0) + 1;
        break;
      }
    }
  });

  return { order: newOrder };
}

export function executeStaffOrderAction({
  orderId,
  action,
  staff,
  note,
  riderId,
}: {
  orderId: string;
  action: OrderAction;
  staff: StaffUser;
  note?: string;
  riderId?: string;
}): { order?: Order; error?: string } {
  const db = getDb();
  const order = db.orders[orderId];
  if (!order) return { error: 'Order not found.' };

  // Check shop permission
  if (staff.role !== 'owner' && staff.shops.length > 0 && !staff.shops.includes(order.loc)) {
    return { error: 'You do not have access to manage orders from this shop location.' };
  }

  const allowedNext = validNextActions(order.type, order.status, !!order.riderId);
  if (!allowedNext.includes(action)) {
    return { error: `Action "${action}" is not permitted for order in "${order.status}" status.` };
  }

  const staffPerms = staff.role === 'owner' ? [] : (db.rolePerms[staff.role] || []);

  const now = Date.now();
  let updatedOrder: Order | null = null;

  mutateDb((d) => {
    const o = d.orders[orderId];
    if (!o) return;

    if (action === 'accept') {
      if (staff.role !== 'owner' && !can(staffPerms, 'orders.manage')) return;
      o.status = 'accepted';
    } else if (action === 'start') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'orders.manage', 'kitchen.bar', 'kitchen.food')) return;
      o.status = 'preparing';
      o.stationStatus.bar = o.stationStatus.bar === 'pending' ? 'preparing' : o.stationStatus.bar;
      o.stationStatus.kitchen = o.stationStatus.kitchen === 'pending' ? 'preparing' : o.stationStatus.kitchen;
    } else if (action === 'ready') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'orders.manage', 'kitchen.bar', 'kitchen.food')) return;
      o.status = 'ready';
      o.stationStatus.bar = 'ready';
      o.stationStatus.kitchen = 'ready';
      o.items.forEach((it) => {
        it.done = true;
      });
    } else if (action === 'dispatch') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'delivery.assign', 'delivery.ride')) return;
      o.status = 'dispatched';
    } else if (action === 'deliver') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'delivery.ride', 'orders.manage')) return;
      o.status = 'delivered';
      o.paid = true;
    } else if (action === 'serve') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'floor.tables', 'orders.manage')) return;
      o.status = 'served';
    } else if (action === 'complete') {
      if (staff.role !== 'owner' && !canAny(staffPerms, 'orders.pay', 'orders.manage')) return;
      o.status = 'completed';
      o.paid = true;
    } else if (action === 'cancel') {
      if (staff.role !== 'owner' && !can(staffPerms, 'orders.manage')) return;
      o.status = 'cancelled';
    } else if (action === 'assign_rider') {
      const isSelfClaim = staff.role === 'rider' && (!riderId || riderId === staff.id);
      if (staff.role !== 'owner' && !can(staffPerms, 'delivery.assign') && !isSelfClaim) return;
      const targetRiderId = riderId || staff.id;
      if (targetRiderId && d.staff[targetRiderId]) {
        const rider = d.staff[targetRiderId];
        o.riderId = rider.id;
        o.riderName = rider.name;
        o.riderPhone = rider.phone;
        o.riderPlate = rider.riderPlate || 'BIKE';
      }
    }

    o.history.push({
      action,
      actor: `${staff.name} (${staff.role})`,
      time: now,
      note,
    });

    logAuditInternal(d, {
      actorId: staff.id,
      actorName: staff.name,
      role: staff.role,
      action: `order.${action}`,
      target: orderId,
      details: note || `Updated status to ${o.status}`,
    });

    updatedOrder = o;
  });

  if (!updatedOrder) {
    return { error: 'Unauthorized to execute this action.' };
  }

  return { order: updatedOrder };
}

export function logAuditInternal(
  db: ReturnType<typeof getDb>,
  entry: Omit<AuditEntry, 'id' | 'timestamp'>
): void {
  const auditItem: AuditEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    ...entry,
  };
  db.audit.unshift(auditItem);
  if (db.audit.length > 500) {
    db.audit.length = 500;
  }
}
