import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserToolResult } from '../src/response';
import type { Context } from '../src/context';
import type { Tab } from '../src/tab';
import type { CdpTarget } from '../src/browser-session';

function makeTab(url: string, title: string, current = false): Tab {
  return {
    page: { url: () => url } as any,
    headerSnapshot: async () => ({ url, title, current, changed: true }),
    isCurrentTab: () => current,
    captureSnapshot: async () => null,
  } as unknown as Tab;
}

function makeContext(tabs: Tab[], cdpTargets: CdpTarget[] = []): Context {
  return {
    tabs: () => tabs,
    currentTab: () => tabs.find(t => t.isCurrentTab()),
    cdpOnlyTargets: () => cdpTargets,
    allTabInfos: () => [
      ...tabs.map((tab, i) => ({ tab, index: i })),
      ...cdpTargets.map((cdpTarget, i) => ({ cdpTarget, index: tabs.length + i })),
    ],
  } as unknown as Context;
}

describe('BrowserToolResult', () => {
  describe('text output', () => {
    it('includes result text under Result section', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      result.addTextResult('hello world');
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Result');
      expect(text).toContain('hello world');
    });

    it('includes error text under Error section and sets isError', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      result.addError('something went wrong');
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Error');
      expect(text).toContain('something went wrong');
      expect(built.isError).toBe(true);
    });

    it('includes code under Ran Playwright code section with js codeframe', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      result.addCode('await page.goto("https://example.com")');
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Ran Playwright code');
      expect(text).toContain('```js');
      expect(text).toContain('await page.goto');
    });

    it('includes page URL and title in Page section', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Page');
      expect(text).toContain('https://example.com');
      expect(text).toContain('Example');
    });

    it('shows Open tabs section when multiple tabs present', async () => {
      const ctx = makeContext([
        makeTab('https://example.com', 'Example', true),
        makeTab('https://github.com', 'GitHub', false),
      ]);
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Open tabs');
      expect(text).toContain('https://example.com');
      expect(text).toContain('https://github.com');
    });

    it('does not show Open tabs section with only one tab', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).not.toContain('### Open tabs');
    });

    it('includes CDP-only tabs in Open tabs section', async () => {
      const cdpTarget: CdpTarget = {
        type: 'page',
        url: 'https://other-window.com',
        title: 'Other Window',
        id: 'abc123',
        webSocketDebuggerUrl: 'ws://localhost:9222/...',
      };
      const ctx = makeContext(
        [makeTab('https://example.com', 'Example', true)],
        [cdpTarget]
      );
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      const text = (built.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('### Open tabs');
      expect(text).toContain('https://other-window.com');
    });
  });

  describe('image output', () => {
    it('encodes PNG image as base64 with correct mimeType', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      const fakeImage = Buffer.from('fake-png-data');
      await result.registerImageResult(fakeImage, 'png');
      const built = await result.build();
      const imgBlock = built.content.find(c => c.type === 'image') as { type: 'image'; data: string; mimeType: string } | undefined;
      expect(imgBlock).toBeDefined();
      expect(imgBlock!.mimeType).toBe('image/png');
      expect(imgBlock!.data).toBe(fakeImage.toString('base64'));
    });

    it('encodes JPEG image with correct mimeType', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      await result.registerImageResult(Buffer.from('fake-jpeg'), 'jpeg');
      const built = await result.build();
      const imgBlock = built.content.find(c => c.type === 'image') as { type: 'image'; mimeType: string } | undefined;
      expect(imgBlock!.mimeType).toBe('image/jpeg');
    });
  });

  describe('details', () => {
    it('includes tab headers in details', async () => {
      const ctx = makeContext([makeTab('https://example.com', 'Example', true)]);
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      expect(built.details.tabs).toHaveLength(1);
      expect(built.details.tabs[0].url).toBe('https://example.com');
    });

    it('sets isClose when no tabs are open', async () => {
      const ctx = makeContext([]);
      const result = new BrowserToolResult(ctx);
      const built = await result.build();
      expect(built.details.isClose).toBe(true);
    });
  });
});
