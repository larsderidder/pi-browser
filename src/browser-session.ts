/**
 * BrowserSession - manages the Browser and Context lifecycle.
 * Handles CDP attach, persistent launch, and isolated launch modes.
 */

import * as pw from 'playwright';
import { Context } from './context';
import type { ContextConfig } from './context';

export type ConnectionMode =
  | { type: 'cdp'; port: number }
  | { type: 'launch'; browserName?: 'chromium' | 'firefox' | 'webkit' }
  | { type: 'isolated'; browserName?: 'chromium' | 'firefox' | 'webkit' };

export class BrowserSession {
  private _browser: pw.Browser | null = null;
  private _context: Context | null = null;
  private _mode: ConnectionMode | null = null;

  get context(): Context | null {
    return this._context;
  }

  get isConnected(): boolean {
    return this._browser !== null && this._browser.isConnected();
  }

  async connect(mode: ConnectionMode, config: ContextConfig = {}): Promise<void> {
    if (this._browser)
      await this.disconnect();

    this._mode = mode;

    switch (mode.type) {
      case 'cdp': {
        const endpoint = `http://localhost:${mode.port}`;
        this._browser = await pw.chromium.connectOverCDP(endpoint);

        let contexts = this._browser.contexts();
        if (contexts.length === 0) await this._browser.newContext();
        contexts = this._browser.contexts();

        // Also fetch the full tab list from CDP so Context can show tabs
        // in other windows that Playwright can't directly control.
        const resp = await fetch(`${endpoint}/json/list`);
        const allTargets: CdpTarget[] = await resp.json();

        this._context = new Context(contexts, config, { port: mode.port, allTargets });
        this._browser.on('disconnected', () => { this._browser = null; this._context = null; });
        break;
      }

      case 'launch': {
        const browserType = pw[mode.browserName ?? 'chromium'];
        const browserContext = await browserType.launchPersistentContext('', {
          headless: false,
          handleSIGINT: false,
          handleSIGTERM: false,
        });
        this._browser = browserContext.browser()!;
        this._context = new Context(browserContext, config);
        break;
      }

      case 'isolated': {
        const browserType = pw[mode.browserName ?? 'chromium'];
        this._browser = await browserType.launch({
          headless: false,
          handleSIGINT: false,
          handleSIGTERM: false,
        });
        const browserContext = await this._browser.newContext();
        this._context = new Context(browserContext, config);
        break;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this._context) {
      await this._context.dispose();
      this._context = null;
    }
    if (this._browser) {
      try { await this._browser.close(); } catch { /* ignore */ }
      this._browser = null;
    }
    this._mode = null;
  }

  status(): string {
    if (!this._browser || !this._browser.isConnected())
      return 'disconnected';
    const mode = this._mode;
    if (!mode) return 'disconnected';
    if (mode.type === 'cdp')
      return `connected via CDP (port ${(mode as { type: 'cdp'; port: number }).port})`;
    if (mode.type === 'launch')
      return `connected (launched ${(mode as { type: 'launch'; browserName?: string }).browserName ?? 'chromium'})`;
    return `connected (isolated ${(mode as { type: 'isolated'; browserName?: string }).browserName ?? 'chromium'})`;
  }
}

export type CdpTarget = {
  type: string;
  url: string;
  title: string;
  id: string;
  webSocketDebuggerUrl: string;
};
