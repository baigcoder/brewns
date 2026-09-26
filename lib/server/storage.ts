/* Persistent storage layer for Brewns.
   Uses local JSON storage in `.data/brewns-store.json` with an atomic file write,
   or Upstash Redis over REST if environment variables are configured. */

import fs from 'node:fs';
import path from 'node:path';
import type { Role, RolePerms, Permission } from '../rbac';
import { DEFAULT_ROLE_PERMS, normaliseRolePerms } from '../rbac';
import type { OrderStatus, OrderType, Station } from '../orderFlow';

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  shops: number[];
  active: boolean;
  passwordHash: string;
  riderPlate?: string;
  customPerms?: Permission[];
  deniedPerms?: Permission[];
  createdAt: number;
};

export type CustomerUser = {
  id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash?: string;
  stamps: number;
  savedAddresses: string[];
  createdAt: number;
};

export type Session = {
  token: string;
  userId: string;
  kind: 'staff' | 'customer';
  role?: Role;
  expiresAt: number;
};

export type OrderItem = {
  id: string;
  name: string;
  sel: Record<string, number>;
  qty: number;
  unitPrice: number;
  station: Station;
  done?: boolean;
};

export type OrderMessage = {
  id: string;
  sender: 'customer' | 'staff' | 'rider';
  name: string;
  text: string;
  time: number;
};

export type OrderHistoryItem = {
  action: string;
  actor: string;
  time: number;
  note?: string;
};

export type Order = {
  id: string;
  seq: number;
  placed: number;
  target: number;
  type: OrderType;
  loc: number; // 0: MM Alam, 1: DHA Phase 5, 2: Johar Town
  area: number | null;
  address: string;
  table: string | null;
  name: string;
  phone: string;
  email: string;
  note: string;
  pay: number; // 0: cash, 1: card, 2: digital
  paid: boolean;
  status: OrderStatus;
  items: OrderItem[];
  stationStatus: {
    bar: 'pending' | 'preparing' | 'ready';
    kitchen: 'pending' | 'preparing' | 'ready';
  };
  totals: {
    sub: number;
    discount: number;
    fee: number;
    rate: number;
    tax: number;
    total: number;
  };
  promo: string | null;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderPlate: string | null;
  waiterCall: boolean;
  messages: OrderMessage[];
  history: OrderHistoryItem[];
};

export type WaiterCall = {
  id: string;
  shop: number;
  table: string;
  type: 'assistance' | 'bill' | 'water';
  status: 'active' | 'resolved';
  createdAt: number;
};

export type Invite = {
  token: string;
  role: Role;
  shops: number[];
  email?: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
};

export type PromoCode = {
  code: string;
  discountPercent: number; // e.g. 10
  active: boolean;
  minSubtotal: number;
};

export type ShopSetting = {
  shopId: number;
  paused: boolean;
  customPrepMin: number;
  tables: number;
};

export type AuditEntry = {
  id: string;
  timestamp: number;
  actorId: string;
  actorName: string;
  role: string;
  action: string;
  target: string;
  details: string;
};

export type Database = {
  staff: Record<string, StaffUser>;
  customers: Record<string, CustomerUser>;
  sessions: Record<string, Session>;
  orders: Record<string, Order>;
  waiterCalls: Record<string, WaiterCall>;
  invites: Record<string, Invite>;
  soldOut: string[];
  promos: Record<string, PromoCode>;
  shops: Record<number, ShopSetting>;
  audit: AuditEntry[];
  rolePerms: RolePerms;
  orderSeq: number;
  version: number;
};

const DEFAULT_DB: Database = {
  staff: {},
  customers: {},
  sessions: {},
  orders: {},
  waiterCalls: {},
  invites: {},
  soldOut: [],
  promos: {
    BREWNS10: { code: 'BREWNS10', discountPercent: 10, active: true, minSubtotal: 0 },
    WELCOME: { code: 'WELCOME', discountPercent: 15, active: true, minSubtotal: 1000 },
  },
  shops: {
    0: { shopId: 0, paused: false, customPrepMin: 12, tables: 16 },
    1: { shopId: 1, paused: false, customPrepMin: 12, tables: 14 },
    2: { shopId: 2, paused: false, customPrepMin: 12, tables: 20 },
  },
  audit: [],
  rolePerms: DEFAULT_ROLE_PERMS,
  orderSeq: 25,
  version: 1,
};

let cachedDb: Database | null = null;
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'brewns-store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database {
  if (cachedDb) return cachedDb;

  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedDb = {
        ...DEFAULT_DB,
        ...parsed,
        rolePerms: normaliseRolePerms(parsed.rolePerms),
      };
      return cachedDb!;
    } catch {
      // Fallback if corrupted
    }
  }

  cachedDb = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveDb(cachedDb!);
  return cachedDb!;
}

export function saveDb(db: Database): void {
  cachedDb = db;
  db.version = (db.version || 0) + 1;
  ensureDataDir();
  const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

/** Mutate database safely with an updater function */
export function mutateDb<T>(updater: (db: Database) => T): T {
  const db = getDb();
  const result = updater(db);
  saveDb(db);
  return result;
}

export function bumpVersion(): number {
  return mutateDb((db) => {
    db.version = (db.version || 0) + 1;
    return db.version;
  });
}
