import { describe, it, expect } from 'vitest';

// Extracted from tools/network.ts for unit testing without browser deps
function isFetch(resourceType: string): boolean {
  return ['fetch', 'xhr'].includes(resourceType);
}

function matchesFilter(url: string, filter: string | undefined): boolean {
  if (!filter) return true;
  return new RegExp(filter).test(url);
}

describe('network filtering', () => {
  describe('isFetch', () => {
    it('returns true for fetch requests', () => {
      expect(isFetch('fetch')).toBe(true);
    });

    it('returns true for xhr requests', () => {
      expect(isFetch('xhr')).toBe(true);
    });

    it('returns false for static resources', () => {
      expect(isFetch('image')).toBe(false);
      expect(isFetch('stylesheet')).toBe(false);
      expect(isFetch('script')).toBe(false);
      expect(isFetch('font')).toBe(false);
      expect(isFetch('document')).toBe(false);
    });
  });

  describe('matchesFilter', () => {
    it('matches all requests when no filter given', () => {
      expect(matchesFilter('https://api.example.com/users', undefined)).toBe(true);
      expect(matchesFilter('https://example.com/static/image.png', undefined)).toBe(true);
    });

    it('filters by URL regex', () => {
      expect(matchesFilter('https://example.com/api/users', 'api/.*')).toBe(true);
      expect(matchesFilter('https://example.com/page', 'api/.*')).toBe(false);
    });

    it('matches partial URL patterns', () => {
      expect(matchesFilter('https://example.com/api/v2/users', 'users')).toBe(true);
      expect(matchesFilter('https://example.com/api/v2/posts', 'users')).toBe(false);
    });

    it('supports anchored patterns', () => {
      expect(matchesFilter('https://api.example.com', '^https://api')).toBe(true);
      expect(matchesFilter('https://www.example.com', '^https://api')).toBe(false);
    });
  });
});
