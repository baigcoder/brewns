/* Shared order lifecycle definitions, station assignments, and state transitions. */

import type { Role, Permission } from './rbac';

export type OrderType = 'pickup' | 'delivery' | 'dinein';

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'served'
  | 'completed'
  | 'cancelled';

export type Station = 'bar' | 'kitchen';

export type OrderAction =
  | 'accept'
  | 'start'
  | 'ready'
  | 'dispatch'
  | 'deliver'
  | 'serve'
  | 'complete'
  | 'cancel'
  | 'assign_rider';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  pickup: 'PICKUP',
  delivery: 'DELIVERY',
  dinein: 'DINE-IN',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'NEW',
  accepted: 'ACCEPTED',
  preparing: 'PREPARING',
  ready: 'READY',
  dispatched: 'ON THE WAY',
  delivered: 'DELIVERED',
  served: 'SERVED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export const STATUS_PILL_COLOR: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  placed: { bg: 'rgb(245 158 11 / 0.15)', text: '#F59E0B', border: '#F59E0B' },
  accepted: { bg: 'rgb(59 130 246 / 0.15)', text: '#60A5FA', border: '#3B82F6' },
  preparing: { bg: 'rgb(249 115 22 / 0.15)', text: '#FB923C', border: '#F97316' },
  ready: { bg: 'rgb(34 197 94 / 0.15)', text: '#4ADE80', border: '#22C55E' },
  dispatched: { bg: 'rgb(168 85 247 / 0.15)', text: '#C084FC', border: '#A855F7' },
  delivered: { bg: 'rgb(16 185 129 / 0.15)', text: '#34D399', border: '#10B981' },
  served: { bg: 'rgb(20 184 166 / 0.15)', text: '#2DD4BF', border: '#14B8A6' },
  completed: { bg: 'rgb(120 113 108 / 0.2)', text: '#A8A29E', border: '#78716C' },
  cancelled: { bg: 'rgb(239 68 68 / 0.15)', text: '#F87171', border: '#EF4444' },
};

/** Convert order status to stage index (0-3) for customer tracker */
export function statusToStage(type: OrderType, status: OrderStatus): number {
  if (status === 'cancelled') return -1;
  switch (type) {
    case 'pickup':
      if (status === 'placed') return 0;
      if (status === 'accepted' || status === 'preparing') return 1;
      if (status === 'ready') return 2;
      return 3; // collected / completed
    case 'delivery':
      if (status === 'placed') return 0;
      if (status === 'accepted' || status === 'preparing') return 1;
      if (status === 'ready' || status === 'dispatched') return 2;
      return 3; // delivered
    case 'dinein':
      if (status === 'placed') return 0;
      if (status === 'accepted' || status === 'preparing') return 1;
      if (status === 'ready' || status === 'served') return 2;
      return 3; // completed
  }
}

/** Check what actions can be performed on an order and the required permissions */
export const ACTION_PERMS: Record<OrderAction, Permission[]> = {
  accept: ['orders.manage'],
  start: ['orders.manage', 'kitchen.bar', 'kitchen.food'],
  ready: ['orders.manage', 'kitchen.bar', 'kitchen.food'],
  dispatch: ['delivery.assign', 'delivery.ride'],
  deliver: ['delivery.ride', 'orders.manage'],
  serve: ['floor.tables', 'orders.manage'],
  complete: ['orders.pay', 'orders.manage'],
  cancel: ['orders.manage'],
  assign_rider: ['delivery.assign'],
};

export function validNextActions(
  type: OrderType,
  status: OrderStatus,
  hasAssignedRider: boolean
): OrderAction[] {
  if (status === 'cancelled' || status === 'completed' || status === 'delivered') {
    return [];
  }

  const actions: OrderAction[] = [];

  if (status === 'placed') {
    actions.push('accept', 'cancel');
  } else if (status === 'accepted') {
    actions.push('start', 'ready', 'cancel');
    if (type === 'delivery' && !hasAssignedRider) {
      actions.push('assign_rider', 'dispatch');
    }
  } else if (status === 'preparing') {
    actions.push('ready', 'cancel');
    if (type === 'delivery' && !hasAssignedRider) {
      actions.push('assign_rider', 'dispatch');
    }
  } else if (status === 'ready') {
    if (type === 'pickup') {
      actions.push('complete');
    } else if (type === 'delivery') {
      actions.push('dispatch');
      if (!hasAssignedRider) {
        actions.push('assign_rider');
      }
    } else if (type === 'dinein') {
      actions.push('serve', 'complete');
    }
  } else if (status === 'dispatched') {
    if (type === 'delivery') {
      actions.push('deliver', 'complete');
    }
  } else if (status === 'served') {
    if (type === 'dinein') {
      actions.push('complete');
    }
  }

  return actions;
}
