import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* The public review routes are unauthenticated, so what protects them is a rate limit on each action.
   This pins the limit that stops one person marking a review "helpful" over and over. */
describe('public reviews route', () => {
  const src = readFileSync(path.join(process.cwd(), 'app', 'api', 'public', 'reviews', 'route.ts'), 'utf8');

  it('lets one visitor mark one review helpful once a day', () => {
    expect(src).toMatch(/review-vote:\$\{clientIp\(req\)\}:\$\{id[^}]*\}`, 1, 86400/);
  });

  it('only staff who manage shops can delete', () => {
    expect(src).toMatch(/DELETE[\s\S]*requireStaff\(\['shops\.manage'\]\)/);
  });
});
