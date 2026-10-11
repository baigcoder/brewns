import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/* Every API route under /api/staff and /api/console is for signed-in staff, so each
   must go through requireStaff(): "is signed in" alone is not enough, because a rider's
   account would then reach what only managers should. This fails the build the moment a
   route is added (or loosened) without a guard. */

const routes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? routes(full) : name === 'route.ts' ? [full] : [];
  });

const root = path.join(process.cwd(), 'app', 'api');
const files = [...routes(path.join(root, 'staff')), ...routes(path.join(root, 'console'))];
const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');

/** Routes that sign in with requireStaff() and no permission, because the permission is decided per action inside. */
const PER_ACTION = new Set([
  'staff/live/route.ts', // filters everything it returns by the caller's own permissions and shops
  'staff/me/route.ts', // a person's own account: viewing and changing their own password
  'staff/two-step/route.ts', // a person's own two-step sign-in: every change re-asks for their password
  'staff/orders/[number]/route.ts', // every action calls need(...) in lib/server/orders.ts
]);

/** The only routes allowed to merely look at who is signed in: signing out reads the session to end it, and the site's header reads a name to greet them. */
const MAY_READ_SESSION = new Set(['auth/signout/route.ts', 'public/whoami/route.ts']);

describe('every API route', () => {
  it('never settles for "signed in as staff" alone, anywhere (a rider could then do a manager job)', () => {
    const loose = routes(root)
      .filter((f) => /currentStaff\(\)/.test(readFileSync(f, 'utf8')) && !MAY_READ_SESSION.has(rel(f)))
      .map(rel);
    expect(loose).toEqual([]);
  });
});

describe('staff and console API routes', () => {
  it('finds the routes', () => expect(files.length).toBeGreaterThan(10));

  it('every route is guarded with requireStaff', () => {
    const unguarded = files.filter((f) => !/requireStaff\(/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(unguarded).toEqual([]);
  });

  it('never trusts "signed in" alone: no currentStaff() in place of a permission check', () => {
    const loose = files.filter((f) => /currentStaff\(\)/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(loose).toEqual([]);
  });

  it('asks for a named permission unless it is on the per-action list', () => {
    const bare = files
      .filter((f) => !PER_ACTION.has(rel(f)))
      .filter((f) => !/requireStaff\(\s*\[\s*'/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(bare).toEqual([]);
  });
});
