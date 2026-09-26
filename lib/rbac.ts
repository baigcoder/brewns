/* Who can do what: the roles at brewns and the permissions each one carries.

   Every check on the server goes through `can()`, with the role's permissions
   as the owner has set them on the Access page (or these defaults until then).
   The same data draws the console's navigation, so a screen a role can't use
   never shows up in its menu. Pure: shared by the server and the console. */

export const ROLES = ['owner', 'manager', 'cashier', 'barista', 'chef', 'waiter', 'rider'] as const;
export type Role = (typeof ROLES)[number];
export type AccountKind = 'staff' | 'customer';

export const ROLE_INFO: Record<Role, { label: string; blurb: string }> = {
  owner: { label: 'Owner', blurb: 'Everything, including who can do what.' },
  manager: { label: 'Manager', blurb: 'Runs the shops day to day: orders, menu, team, reports.' },
  cashier: { label: 'Cashier', blurb: 'The counter: takes orders and payments, hands over pickups, dispatches riders.' },
  barista: { label: 'Barista', blurb: 'The bar: coffee, coolers and bakery tickets.' },
  chef: { label: 'Chef', blurb: 'The kitchen: burgers, pizza, pasta and rolls.' },
  waiter: { label: 'Waiter', blurb: 'The floor: tables, calls, serving and table bills.' },
  rider: { label: 'Rider', blurb: 'Deliveries: picks up, rides, hands over and collects cash.' },
};

/** Higher manages lower: a manager can invite a waiter, not another manager. */
export const ROLE_RANK: Record<Role, number> = { owner: 100, manager: 50, cashier: 10, barista: 10, chef: 10, waiter: 10, rider: 10 };

export const PERMISSIONS = {
  'reports.view': { group: 'Business', label: 'Sales and reports', desc: 'Revenue, orders, top items and how each shop is doing.' },
  'customers.view': { group: 'Business', label: 'Customers and club', desc: 'Customer accounts, their orders and club cards.' },
  'audit.view': { group: 'Business', label: 'Activity log', desc: 'Who did what, and when.' },
  'orders.view': { group: 'Orders', label: 'See every order', desc: 'The live board and order history, with customer details.' },
  'orders.create': { group: 'Orders', label: 'Take orders', desc: 'Ring up walk-ins and table orders.' },
  'orders.manage': { group: 'Orders', label: 'Run orders', desc: 'Accept, mark ready, hand over and cancel.' },
  'orders.pay': { group: 'Orders', label: 'Take payment', desc: 'Mark orders and table bills as paid.' },
  'messages.reply': { group: 'Orders', label: 'Message customers', desc: 'Answer customers in their order chat.' },
  'kitchen.bar': { group: 'Stations', label: 'Bar tickets', desc: 'Coffee, coolers and bakery on the kitchen screen.' },
  'kitchen.food': { group: 'Stations', label: 'Kitchen tickets', desc: 'Burgers, pizza, pasta and rolls on the kitchen screen.' },
  'floor.tables': { group: 'Stations', label: 'Tables and calls', desc: 'Table map, waiter calls, serving.' },
  'delivery.ride': { group: 'Stations', label: 'Ride deliveries', desc: 'Take a delivery, ride it, hand it over.' },
  'delivery.assign': { group: 'Stations', label: 'Dispatch riders', desc: 'Give deliveries to riders.' },
  'menu.availability': { group: 'Menu and shops', label: 'Sold out', desc: 'Take items off the menu when they run out.' },
  'menu.promos': { group: 'Menu and shops', label: 'Promo codes', desc: 'Create and switch off promo codes.' },
  'shops.manage': { group: 'Menu and shops', label: 'Shop settings', desc: 'Pause online orders, wait times, tables and QR codes.' },
  'staff.view': { group: 'Team', label: 'See the team', desc: 'Everyone on staff and their roles.' },
  'staff.manage': { group: 'Team', label: 'Manage the team', desc: 'Invite, change roles, reset passwords, deactivate.' },
  'access.manage': { group: 'Team', label: 'Access control', desc: 'Change what each role can do. Owners only.' },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions only an owner can ever hold: giving them away would let anyone promote themselves. */
export const OWNER_ONLY: readonly Permission[] = ['access.manage'];

export type RolePerms = Record<Role, Permission[]>;

export const DEFAULT_ROLE_PERMS: RolePerms = {
  owner: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p)),
  cashier: ['orders.view', 'orders.create', 'orders.manage', 'orders.pay', 'messages.reply', 'delivery.assign', 'menu.availability'],
  barista: ['kitchen.bar', 'menu.availability'],
  chef: ['kitchen.food', 'menu.availability'],
  waiter: ['floor.tables', 'orders.create', 'orders.pay'],
  rider: ['delivery.ride', 'messages.reply'],
};

/** The matrix as stored, cleaned: unknown names dropped, owner always whole, owner-only kept to owners. */
export function normaliseRolePerms(raw: unknown): RolePerms {
  const out = {} as RolePerms;
  for (const role of ROLES) {
    if (role === 'owner') {
      out.owner = ALL_PERMISSIONS;
      continue;
    }
    const list = (raw as Partial<Record<Role, unknown>> | null)?.[role];
    out[role] = Array.isArray(list)
      ? ALL_PERMISSIONS.filter((p) => list.includes(p) && !OWNER_ONLY.includes(p))
      : DEFAULT_ROLE_PERMS[role];
  }
  return out;
}

export const permsFor = (role: Role, matrix: RolePerms = DEFAULT_ROLE_PERMS): Permission[] => (role === 'owner' ? ALL_PERMISSIONS : matrix[role] || []);

export const can = (perms: readonly string[], ...need: Permission[]) => need.every((p) => perms.includes(p));
export const canAny = (perms: readonly string[], ...need: Permission[]) => need.some((p) => perms.includes(p));

/** Can someone with role `actor` create, edit or remove someone with role `target`? */
export const outranks = (actor: Role, target: Role) => actor === 'owner' || ROLE_RANK[actor] > ROLE_RANK[target];

/* ── the console's screens ── */

export type Section = {
  key: string;
  href: string;
  label: string;
  /** Any one of these opens the screen. Empty: everyone signed in. */
  any: Permission[];
  group: 'Run' | 'Manage' | 'You';
};

export const SECTIONS: Section[] = [
  { key: 'overview', href: '/dashboard/overview', label: 'Overview', any: ['reports.view'], group: 'Run' },
  { key: 'orders', href: '/dashboard/orders', label: 'Orders', any: ['orders.view'], group: 'Run' },
  { key: 'new', href: '/dashboard/new', label: 'New order', any: ['orders.create'], group: 'Run' },
  { key: 'kitchen', href: '/dashboard/kitchen', label: 'Kitchen', any: ['kitchen.bar', 'kitchen.food'], group: 'Run' },
  { key: 'floor', href: '/dashboard/floor', label: 'Floor', any: ['floor.tables'], group: 'Run' },
  { key: 'deliveries', href: '/dashboard/deliveries', label: 'Deliveries', any: ['delivery.ride', 'delivery.assign'], group: 'Run' },
  { key: 'menu', href: '/dashboard/menu', label: 'Menu', any: ['menu.availability', 'menu.promos'], group: 'Manage' },
  { key: 'shops', href: '/dashboard/shops', label: 'Shops', any: ['shops.manage'], group: 'Manage' },
  { key: 'staff', href: '/dashboard/staff', label: 'Team', any: ['staff.view'], group: 'Manage' },
  { key: 'access', href: '/dashboard/access', label: 'Access', any: ['access.manage'], group: 'Manage' },
  { key: 'customers', href: '/dashboard/customers', label: 'Customers', any: ['customers.view'], group: 'Manage' },
  { key: 'activity', href: '/dashboard/activity', label: 'Activity', any: ['audit.view'], group: 'Manage' },
  { key: 'account', href: '/dashboard/account', label: 'My account', any: [], group: 'You' },
];

export const sectionByKey = (key: string) => SECTIONS.find((s) => s.key === key);
export const canOpen = (perms: readonly string[], s: Section) => !s.any.length || canAny(perms, ...s.any);

/** Where each role lands after signing in: the first screen that is its job. */
const HOME_ORDER: Record<Role, string[]> = {
  owner: ['overview'],
  manager: ['overview', 'orders'],
  cashier: ['orders', 'new'],
  barista: ['kitchen'],
  chef: ['kitchen'],
  waiter: ['floor', 'new'],
  rider: ['deliveries'],
};
export function homeFor(role: Role, perms: readonly string[]) {
  const first = [...HOME_ORDER[role], ...SECTIONS.map((s) => s.key)].map(sectionByKey).find((s) => s && canOpen(perms, s));
  return first?.href || '/dashboard/account';
}
