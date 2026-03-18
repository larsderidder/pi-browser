import { describe, it, expect } from 'vitest';
import { Context } from '../src/context';
import type { CdpTarget } from '../src/browser-session';

function makePage(url: string) {
  const listeners: Record<string, Function[]> = {};
  return {
    url: () => url,
    title: async () => url,
    close: async () => {},
    bringToFront: async () => {},
    on: (event: string, fn: Function) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(fn);
    },
    emit: (event: string, ...args: any[]) => {
      (listeners[event] ?? []).forEach(fn => fn(...args));
    },
  };
}

function makeBrowserContext(pages: ReturnType<typeof makePage>[]) {
  const listeners: Record<string, Function[]> = {};
  return {
    pages: () => pages,
    on: (event: string, fn: Function) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(fn);
    },
    emit: (event: string, ...args: any[]) => {
      (listeners[event] ?? []).forEach(fn => fn(...args));
    },
    newPage: async () => {
      const p = makePage('about:blank');
      pages.push(p);
      (listeners['page'] ?? []).forEach(fn => fn(p));
      return p;
    },
    route: async () => {},
    unroute: async () => {},
    setOffline: async () => {},
    cookies: async () => [],
    addCookies: async () => {},
    clearCookies: async () => {},
    storageState: async () => ({}),
    addInitScript: async () => {},
  };
}

describe('Context', () => {
  describe('tab management', () => {
    it('registers pages from browserContext on construction', () => {
      const pages = [makePage('https://example.com'), makePage('https://github.com')];
      const ctx = new Context(makeBrowserContext(pages) as any);
      expect(ctx.tabs()).toHaveLength(2);
    });

    it('sets the first page as current tab', () => {
      const pages = [makePage('https://example.com'), makePage('https://github.com')];
      const ctx = new Context(makeBrowserContext(pages) as any);
      expect(ctx.currentTab()?.page.url()).toBe('https://example.com');
    });

    it('picks up new pages added after construction', () => {
      const pages = [makePage('https://example.com')];
      const bc = makeBrowserContext(pages);
      const ctx = new Context(bc as any);
      const newPage = makePage('https://new.com');
      pages.push(newPage);
      bc.emit('page', newPage);
      expect(ctx.tabs()).toHaveLength(2);
    });

    it('removes a tab when its page closes', () => {
      const pages = [makePage('https://example.com'), makePage('https://github.com')];
      const ctx = new Context(makeBrowserContext(pages) as any);
      pages[1].emit('close');
      expect(ctx.tabs()).toHaveLength(1);
    });

    it('selects a tab by index', async () => {
      const pages = [makePage('https://example.com'), makePage('https://github.com')];
      const ctx = new Context(makeBrowserContext(pages) as any);
      await ctx.selectTab(1);
      expect(ctx.currentTab()?.page.url()).toBe('https://github.com');
    });

    it('throws when selecting an out-of-range index', async () => {
      const pages = [makePage('https://example.com')];
      const ctx = new Context(makeBrowserContext(pages) as any);
      await expect(ctx.selectTab(5)).rejects.toThrow('Tab 5 not found');
    });
  });

  describe('CDP-only targets', () => {
    it('tracks CDP-only targets passed at construction', () => {
      const pages = [makePage('https://example.com')];
      const cdpTargets: CdpTarget[] = [{
        type: 'page',
        url: 'https://other.com',
        title: 'Other',
        id: 'abc',
        webSocketDebuggerUrl: 'ws://...',
      }];
      const ctx = new Context(makeBrowserContext(pages) as any, {}, { port: 9222, allTargets: cdpTargets });
      expect(ctx.cdpOnlyTargets()).toHaveLength(1);
      expect(ctx.cdpOnlyTargets()[0].url).toBe('https://other.com');
    });

    it('does not include CDP targets whose URL is already in a Playwright tab', () => {
      const pages = [makePage('https://example.com')];
      const cdpTargets: CdpTarget[] = [{
        type: 'page',
        url: 'https://example.com', // same as the Playwright tab
        title: 'Example',
        id: 'abc',
        webSocketDebuggerUrl: 'ws://...',
      }];
      const ctx = new Context(makeBrowserContext(pages) as any, {}, { port: 9222, allTargets: cdpTargets });
      expect(ctx.cdpOnlyTargets()).toHaveLength(0);
    });

    it('excludes about:blank from CDP-only targets', () => {
      const pages = [makePage('https://example.com')];
      const cdpTargets: CdpTarget[] = [{
        type: 'page',
        url: 'about:blank',
        title: '',
        id: 'abc',
        webSocketDebuggerUrl: 'ws://...',
      }];
      const ctx = new Context(makeBrowserContext(pages) as any, {}, { port: 9222, allTargets: cdpTargets });
      expect(ctx.cdpOnlyTargets()).toHaveLength(0);
    });
  });

  describe('allTabInfos', () => {
    it('returns Playwright tabs followed by CDP-only targets with correct indices', () => {
      const pages = [makePage('https://a.com'), makePage('https://b.com')];
      const cdpTargets: CdpTarget[] = [{
        type: 'page',
        url: 'https://c.com',
        title: 'C',
        id: 'abc',
        webSocketDebuggerUrl: 'ws://...',
      }];
      const ctx = new Context(makeBrowserContext(pages) as any, {}, { port: 9222, allTargets: cdpTargets });
      const infos = ctx.allTabInfos();
      expect(infos).toHaveLength(3);
      expect(infos[0].index).toBe(0);
      expect(infos[0].tab).toBeDefined();
      expect(infos[1].index).toBe(1);
      expect(infos[2].index).toBe(2);
      expect(infos[2].cdpTarget?.url).toBe('https://c.com');
    });
  });
});
