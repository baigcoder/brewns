import { describe, expect, it } from 'bun:test';
import { notModified, versionEtag } from '@/lib/server/http';

describe('versioned API responses', () => {
  it('returns a private 304 only when the client presents the matching validator', () => {
    const etag = versionEtag('staff-live', 42, 'staff-1-3');
    const response = notModified(new Request('https://brewns.test/api/staff/live', { headers: { 'If-None-Match': etag } }), etag);

    expect(response?.status).toBe(304);
    expect(response?.headers.get('ETag')).toBe(etag);
    expect(response?.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(notModified(new Request('https://brewns.test/api/staff/live'), etag)).toBeNull();
  });
});
