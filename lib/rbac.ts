/* Production-Grade Role-Based Access Control (RBAC) System
   Provides granular enterprise permissions, branch multi-tenancy scoping,
   per-user overrides, and hierarchical role inheritance for Brewns Coffee House. */

export const ROLES = ['owner', 'manager', 'cashier', 'barista', 'chef', 'waiter', 'rider'] as const;
export type Role = (typeof ROLES)[number];
export type AccountKind = 'staff' | 'customer';

export const ROLE_INFO: Record<Role, { label: string; badge: string; color: string; blurb: string }> = {
  owner: {
    label: 'Owner',
    badge: '👑 Root',
    color: '#D98A2C',
    blurb: 'Executive enterprise control, finances, branch config, and access governance.',
  },
  manager: {
    label: 'Manager',
    badge: '⭐ Operations',
    color: '#3B82F6',
    blurb: 'Shop floor operations, live orders, staff management, menu pricing, and daily analytics.',
  },
  cashier: {
    label: 'Cashier',
    badge: '💳 POS Counter',
    color: '#10B981',
    blurb: 'Walk-in orders, table billing, cash & card collection, pickups, and rider dispatch.',
  },
  barista: {
    label: 'Barista',
    badge: '☕ Espresso Bar',
    color: '#F59E0B',
    blurb: 'Specialty coffee, beverage queue, cold brew, and bakery station fulfillment.',
  },
  chef: {
    label: 'Chef',
    badge: '🍳 Kitchen Station',
    color: '#EC4899',
    blurb: 'Hot food preparation, burgers, artisanal pizza, pasta, and ingredient availability.',
  },
  waiter: {
    label: 'Waiter',
    badge: '🍽️ Floor Service',
    color: '#8B5CF6',
    blurb: 'Dine-in table service, guest call assistance, order taking, and bill presentation.',
  },
  rider: {
    label: 'Rider',
    badge: '🛵 Delivery Fleet',
    color: '#06B6D4',
    blurb: 'Doorstep deliveries, GPS routing, cash collection on delivery, and customer chat.',
  },
};

/** Higher rank manages lower: Owner (100) > Manager (50) > Staff (10) */
export const ROLE_RANK: Record<Role, number> = {
  owner: 100,
  manager: 50,
  cashier: 10,
  barista: 10,
  chef: 10,
  waiter: 10,
  rider: 10,
};

export const PERMISSION_GROUPS = [
  { id: 'business', label: 'Business & Analytics', icon: '📊' },
  { id: 'orders', label: 'Orders & POS Counter', icon: '📋' },
  { id: 'stations', label: 'Stations & Kitchen Displays', icon: '🍳' },
  { id: 'menu', label: 'Menu & Café Branches', icon: '☕' },
  { id: 'team', label: 'Team & Access Governance', icon: '👥' },
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]['id'];

export const PERMISSIONS = {
  // Business & Analytics
  'reports.view': {
    group: 'business' as PermissionGroup,
    label: 'Sales & Reports',
    desc: 'Revenue, orders volume, top items, and shop performance metrics.',
  },
  'reports.financial': {
    group: 'business' as PermissionGroup,
    label: 'Financial Margins & Costs',
    desc: 'Gross profits, beverage margins, and provincial tax liabilities. Strictly confidential.',
  },
  'customers.view': {
    group: 'business' as PermissionGroup,
    label: 'Customer Directory & Club',
    desc: 'Customer accounts, order histories, loyalty stamps, and Brewns Club cards.',
  },
  'audit.view': {
    group: 'business' as PermissionGroup,
    label: 'Activity & Audit Log',
    desc: 'Chronological timeline of system events, logins, and status transitions.',
  },
  'audit.export': {
    group: 'business' as PermissionGroup,
    label: 'Export Compliance Logs',
    desc: 'Download CSV and JSON audit archives for security and bookkeeping.',
  },

  // Orders & POS Counter
  'orders.view': {
    group: 'orders' as PermissionGroup,
    label: 'View Live Orders Board',
    desc: 'Real-time fulfillment Kanban board and detailed order search.',
  },
  'orders.create': {
    group: 'orders' as PermissionGroup,
    label: 'Take POS & Walk-in Orders',
    desc: 'Ring up walk-in counter tickets, phone orders, and table orders.',
  },
  'orders.manage': {
    group: 'orders' as PermissionGroup,
    label: 'Advance Order Pipeline',
    desc: 'Accept incoming orders, mark ready for service, and hand over.',
  },
  'orders.cancel': {
    group: 'orders' as PermissionGroup,
    label: 'Void / Cancel Orders',
    desc: 'Cancel active customer orders (manager-level authorization).',
  },
  'orders.pay': {
    group: 'orders' as PermissionGroup,
    label: 'Collect Payments & Settle',
    desc: 'Mark tickets paid with Cash, POS Card, or Digital Wallets (Raast, JazzCash).',
  },
  'orders.discount': {
    group: 'orders' as PermissionGroup,
    label: 'Manual Staff Discounts',
    desc: 'Apply custom discounts, promotional codes, or hospitality comps.',
  },
  'messages.reply': {
    group: 'orders' as PermissionGroup,
    label: 'Customer Chat Messaging',
    desc: 'Send live updates and replies to customers in the order chat.',
  },

  // Stations & Kitchen Displays
  'kitchen.bar': {
    group: 'stations' as PermissionGroup,
    label: 'Espresso Bar Display (KDS)',
    desc: 'Coffee, specialty coolers, and bakery item tickets on the bar screen.',
  },
  'kitchen.food': {
    group: 'stations' as PermissionGroup,
    label: 'Kitchen & Oven Display (KDS)',
    desc: 'Burgers, pasta, artisan pizza, and roll tickets on the kitchen screen.',
  },
  'floor.tables': {
    group: 'stations' as PermissionGroup,
    label: 'Floor Map & Table Service',
    desc: 'Interactive table occupancy map, waiter call alerts, and dine-in serving.',
  },
  'delivery.ride': {
    group: 'stations' as PermissionGroup,
    label: 'Rider Delivery Runs',
    desc: 'Accept delivery runs, view customer addresses, and mark delivered.',
  },
  'delivery.assign': {
    group: 'stations' as PermissionGroup,
    label: 'Dispatch Delivery Fleet',
    desc: 'Assign ready delivery runs to available riders.',
  },

  // Menu & Café Branches
  'menu.availability': {
    group: 'menu' as PermissionGroup,
    label: 'Sold-Out Item Toggles',
    desc: 'Instantly mark ingredients or products sold out when stock runs low.',
  },
  'menu.prices': {
    group: 'menu' as PermissionGroup,
    label: 'Modify Menu Pricing',
    desc: 'Update product prices, milk upgrade surcharges, and bundle options.',
  },
  'menu.promos': {
    group: 'menu' as PermissionGroup,
    label: 'Manage Promotional Codes',
    desc: 'Create, edit discount percentages, and deactivate promo codes.',
  },
  'shops.manage': {
    group: 'menu' as PermissionGroup,
    label: 'Branch Settings & Hours',
    desc: 'Adjust operating hours, prep lead times, table QR codes, and addresses.',
  },
  'shops.override': {
    group: 'menu' as PermissionGroup,
    label: 'Emergency Pause Ordering',
    desc: 'Temporarily pause new online orders during peak kitchen rushes.',
  },

  // Team & Access Governance
  'staff.view': {
    group: 'team' as PermissionGroup,
    label: 'View Staff Directory',
    desc: 'View team members, phone numbers, branch assignments, and roles.',
  },
  'staff.manage': {
    group: 'team' as PermissionGroup,
    label: 'Manage Staff & Invitations',
    desc: 'Send invite links, update roles, and reset credentials.',
  },
  'staff.deactivate': {
    group: 'team' as PermissionGroup,
    label: 'Deactivate Staff & Kill Sessions',
    desc: 'Immediately suspend staff access and revoke all active login tokens.',
  },
  'access.manage': {
    group: 'team' as PermissionGroup,
    label: 'Access Control Matrix Governance',
    desc: 'Configure what each role can do across the enterprise. Root Owner only.',
  },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions strictly reserved for root Owner */
export const OWNER_ONLY: readonly Permission[] = [
  'access.manage',
  'reports.financial',
];

export type RolePerms = Record<Role, Permission[]>;

export const DEFAULT_ROLE_PERMS: RolePerms = {
  owner: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p)),
  cashier: [
    'orders.view',
    'orders.create',
    'orders.manage',
    'orders.pay',
    'messages.reply',
    'delivery.assign',
    'menu.availability',
  ],
  barista: [
    'kitchen.bar',
    'menu.availability',
  ],
  chef: [
    'kitchen.food',
    'menu.availability',
  ],
  waiter: [
    'floor.tables',
    'orders.create',
    'orders.pay',
  ],
  rider: [
    'delivery.ride',
    'messages.reply',
  ],
};

/** Ensure stored matrix is valid, secure, and preserves owner-only boundaries */
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

export function permsFor(role: Role, matrix: RolePerms = DEFAULT_ROLE_PERMS): Permission[] {
  if (role === 'owner') return ALL_PERMISSIONS;
  return matrix[role] || DEFAULT_ROLE_PERMS[role] || [];
}

/** Compute effective permissions for a user taking into account custom grants and denies */
export function effectivePermsFor(
  user: { role: Role; customPerms?: Permission[]; deniedPerms?: Permission[] },
  matrix: RolePerms = DEFAULT_ROLE_PERMS
): Permission[] {
  if (user.role === 'owner') return ALL_PERMISSIONS;

  const base = matrix[user.role] || DEFAULT_ROLE_PERMS[user.role] || [];
  const custom = user.customPerms || [];
  const denied = user.deniedPerms || [];

  const combined = Array.from(new Set([...base, ...custom]))
    .filter((p) => !denied.includes(p))
    .filter((p) => !OWNER_ONLY.includes(p));

  return combined;
}

/** Check if staff user has scope access to a specific café branch */
export function hasShopScope(
  user: { role: Role; shops?: number[] },
  shopId: number
): boolean {
  if (user.role === 'owner') return true;
  if (!user.shops || user.shops.length === 0) return true; // All branches
  return user.shops.includes(shopId);
}

export const can = (perms: readonly string[], ...need: Permission[]) => need.every((p) => perms.includes(p));
export const canAny = (perms: readonly string[], ...need: Permission[]) => need.some((p) => perms.includes(p));

/** Check if actor outranks target for staff administration */
export const outranks = (actor: Role, target: Role) => actor === 'owner' || ROLE_RANK[actor] > ROLE_RANK[target];

/* ── Console Navigation Sections ── */

export type Section = {
  key: string;
  href: string;
  label: string;
  any: Permission[];
  group: 'Operations' | 'Administration' | 'Personal';
  badge?: string;
};

export const SECTIONS: Section[] = [
  { key: 'overview', href: '/dashboard/overview', label: 'Overview', any: ['reports.view'], group: 'Operations' },
  { key: 'orders', href: '/dashboard/orders', label: 'Live Orders', any: ['orders.view'], group: 'Operations', badge: 'LIVE' },
  { key: 'new', href: '/dashboard/new', label: 'POS Terminal', any: ['orders.create'], group: 'Operations' },
  { key: 'kitchen', href: '/dashboard/kitchen', label: 'Kitchen KDS', any: ['kitchen.bar', 'kitchen.food'], group: 'Operations' },
  { key: 'floor', href: '/dashboard/floor', label: 'Floor Map', any: ['floor.tables'], group: 'Operations' },
  { key: 'deliveries', href: '/dashboard/deliveries', label: 'Delivery Fleet', any: ['delivery.ride', 'delivery.assign'], group: 'Operations' },

  { key: 'menu', href: '/dashboard/menu', label: 'Menu & Stock', any: ['menu.availability', 'menu.promos', 'menu.prices'], group: 'Administration' },
  { key: 'shops', href: '/dashboard/shops', label: 'Branches', any: ['shops.manage', 'shops.override'], group: 'Administration' },
  { key: 'staff', href: '/dashboard/staff', label: 'Team Directory', any: ['staff.view', 'staff.manage'], group: 'Administration' },
  { key: 'access', href: '/dashboard/access', label: 'Access Matrix', any: ['access.manage'], group: 'Administration', badge: 'ROOT' },
  { key: 'customers', href: '/dashboard/customers', label: 'Customers', any: ['customers.view'], group: 'Administration' },
  { key: 'activity', href: '/dashboard/activity', label: 'Audit Trail', any: ['audit.view'], group: 'Administration' },

  { key: 'account', href: '/dashboard/account', label: 'My Account', any: [], group: 'Personal' },
];

export const sectionByKey = (key: string) => SECTIONS.find((s) => s.key === key);
export const canOpen = (perms: readonly string[], s: Section) => !s.any.length || canAny(perms, ...s.any);

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
  const first = [...HOME_ORDER[role], ...SECTIONS.map((s) => s.key)]
    .map(sectionByKey)
    .find((s) => s && canOpen(perms, s));
  return first?.href || '/dashboard/account';
}
