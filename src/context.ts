/**
 * Context - owns the BrowserContext, manages Tab instances.
 * Adapted from playwright-core/src/tools/backend/context.ts.
 */

import type * as pw from 'playwright';
import { Tab } from './tab';
import type { CdpTarget } from './browser-session';

export type ContextConfig = {
  timeouts?: {
    action?: number;
    navigation?: number;
  };
};

export type CdpInfo = {
  port: number;
  allTargets: CdpTarget[];
};

export type RouteEntry = {
  pattern: string;
  status?: number;
  body?: string;
  contentType?: string;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  handler: (route: pw.Route) => Promise<void>;
};

export class Context {
  readonly config: ContextConfig;
  private _browserContexts: pw.BrowserContext[];
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _routes: RouteEntry[] = [];

  // CDP targets not reachable via Playwright (different windows)
  private _cdpOnlyTargets: CdpTarget[] = [];
  private _cdpPort: number | undefined;

  constructor(
    browserContexts: pw.BrowserContext | pw.BrowserContext[],
    config: ContextConfig = {},
    cdpInfo?: CdpInfo,
  ) {
    this._browserContexts = Array.isArray(browserContexts) ? browserContexts : [browserContexts];
    this.config = config;

    for (const ctx of this._browserContexts) {
      for (const page of ctx.pages())
        this._onPageCreated(page);
      ctx.on('page', page => this._onPageCreated(page));
    }

    if (cdpInfo) {
      this._cdpPort = cdpInfo.port;
      this._updateCdpOnlyTargets(cdpInfo.allTargets);
    }
  }

  private _updateCdpOnlyTargets(allTargets: CdpTarget[]) {
    // Pages Playwright knows about
    const playwrightUrls = new Set(this._tabs.map(t => t.page.url()));
    // CDP-only = page targets whose URL isn't in our Playwright tab list
    this._cdpOnlyTargets = allTargets.filter(
      t => t.type === 'page' && !playwrightUrls.has(t.url) && t.url !== 'about:blank'
    );
  }

  async dispose() {
    for (const tab of this._tabs)
      await tab.dispose();
    this._tabs = [];
    this._currentTab = undefined;
    this._cdpOnlyTargets = [];
  }

  browserContext(): pw.BrowserContext {
    return this._browserContexts[0];
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  /** All tabs: Playwright-controlled + CDP-only (read-only, different windows) */
  allTabInfos(): Array<{ tab?: Tab; cdpTarget?: CdpTarget; index: number }> {
    const result: Array<{ tab?: Tab; cdpTarget?: CdpTarget; index: number }> = [];
    this._tabs.forEach((tab, i) => result.push({ tab, index: i }));
    this._cdpOnlyTargets.forEach((t, i) =>
      result.push({ cdpTarget: t, index: this._tabs.length + i })
    );
    return result;
  }

  cdpOnlyTargets(): CdpTarget[] {
    return this._cdpOnlyTargets;
  }

  currentTab(): Tab | undefined {
    return this._currentTab;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab)
      throw new Error('No open pages available.');
    return this._currentTab;
  }

  async ensureTab(): Promise<Tab> {
    if (!this._currentTab)
      await this.newTab();
    return this._currentTab!;
  }

  async newTab(): Promise<Tab> {
    const page = await this._browserContexts[0].newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number): Promise<Tab> {
    if (index < this._tabs.length) {
      // Playwright-controlled tab
      const tab = this._tabs[index];
      const url = tab.page.url();
      if (!url.startsWith('chrome://') && !url.startsWith('chrome-extension://'))
        await tab.page.bringToFront().catch(() => {});
      this._currentTab = tab;
      return tab;
    }

    // CDP-only tab — navigate current Playwright tab to its URL
    const cdpIndex = index - this._tabs.length;
    const target = this._cdpOnlyTargets[cdpIndex];
    if (!target) throw new Error(`Tab ${index} not found`);

    const tab = await this.ensureTab();
    await tab.navigate(target.url);
    // Remove from CDP-only list since Playwright now controls it
    this._cdpOnlyTargets.splice(cdpIndex, 1);
    return tab;
  }

  async closeTab(index: number | undefined): Promise<string> {
    if (index !== undefined && index >= this._tabs.length) {
      // CDP-only tab — can't close via Playwright, just remove from list
      const cdpIndex = index - this._tabs.length;
      const target = this._cdpOnlyTargets[cdpIndex];
      if (!target) throw new Error(`Tab ${index} not found`);
      this._cdpOnlyTargets.splice(cdpIndex, 1);
      return target.url;
    }
    const tab = index === undefined ? this._currentTab : this._tabs[index];
    if (!tab) throw new Error(`Tab ${index} not found`);
    const url = tab.page.url();
    await tab.page.close();
    return url;
  }

  routes(): RouteEntry[] {
    return this._routes;
  }

  async addRoute(entry: RouteEntry): Promise<void> {
    await this._browserContexts[0].route(entry.pattern, entry.handler);
    this._routes.push(entry);
  }

  async removeRoute(pattern?: string): Promise<number> {
    if (pattern) {
      const toRemove = this._routes.filter(r => r.pattern === pattern);
      for (const r of toRemove)
        await this._browserContexts[0].unroute(r.pattern, r.handler);
      this._routes = this._routes.filter(r => r.pattern !== pattern);
      return toRemove.length;
    }
    for (const r of this._routes)
      await this._browserContexts[0].unroute(r.pattern, r.handler);
    const count = this._routes.length;
    this._routes = [];
    return count;
  }

  private _onPageCreated(page: pw.Page) {
    const tab = new Tab(this, page, (t: Tab) => this._onPageClosed(t));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1) return;
    this._tabs.splice(index, 1);
    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
  }
}
