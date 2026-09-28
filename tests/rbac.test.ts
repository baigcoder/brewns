import { describe, expect, it } from 'bun:test';
import { can, canAny, outranks, DEFAULT_ROLE_PERMS, OWNER_ONLY, ROLES } from '@/lib/rbac';

describe('Role-Based Access Control (RBAC)', () => {
  it('gives owner all permissions', () => {
    const ownerPerms = DEFAULT_ROLE_PERMS.owner;
    expect(can(ownerPerms, 'access.manage')).toBe(true);
    expect(can(ownerPerms, 'reports.view')).toBe(true);
    expect(can(ownerPerms, 'orders.manage')).toBe(true);
  });

  it('restricts owner-only permissions from manager', () => {
    const managerPerms = DEFAULT_ROLE_PERMS.manager;
    expect(can(managerPerms, 'access.manage')).toBe(false);
    expect(can(managerPerms, 'reports.view')).toBe(true);
    expect(can(managerPerms, 'staff.manage')).toBe(true);
  });

  it('restricts sensitive financial reports from baristas and chefs', () => {
    const baristaPerms = DEFAULT_ROLE_PERMS.barista;
    const chefPerms = DEFAULT_ROLE_PERMS.chef;

    expect(can(baristaPerms, 'reports.view')).toBe(false);
    expect(can(chefPerms, 'reports.view')).toBe(false);
    expect(can(baristaPerms, 'kitchen.bar')).toBe(true);
    expect(can(chefPerms, 'kitchen.food')).toBe(true);
  });

  it('checks role rank hierarchies correctly', () => {
    expect(outranks('owner', 'manager')).toBe(true);
    expect(outranks('owner', 'barista')).toBe(true);
    expect(outranks('manager', 'barista')).toBe(true);
    expect(outranks('manager', 'owner')).toBe(false);
    expect(outranks('manager', 'manager')).toBe(false); // Peers cannot manage peers
    expect(outranks('barista', 'manager')).toBe(false);
  });

  it('handles canAny correctly for multiple permission checks', () => {
    const waiterPerms = DEFAULT_ROLE_PERMS.waiter;
    expect(canAny(waiterPerms, 'reports.view', 'floor.tables')).toBe(true);
    expect(canAny(waiterPerms, 'reports.view', 'staff.manage')).toBe(false);
  });
});
