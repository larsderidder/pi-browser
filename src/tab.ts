/**
 * Tab - wraps a single Playwright Page.
 * Adapted from playwright-core/src/tools/backend/tab.ts.
 */

import type * as pw from 'playwright';
import type { Context } from './context';
import type { TabHeader } from './response';

export type ModalState =
  | { type: 'dialog'; description: string; dialog: pw.Dialog }
  | { type: 'fileChooser'; description: string; fileChooser: pw.FileChooser };

export type TabSnapshot = {
  ariaSnapshot: string;
  ariaSnapshotDiff?: string;
  modalStates: ModalState[];
};

export type ConsoleMessage = {
  type: string;
  timestamp: number;
  text: string;
  toString(): string;
};

export class Tab {
  readonly context: Context;
  readonly page: pw.Page;
  private _modalStates: ModalState[] = [];
  private _onPageClose: (tab: Tab) => void;
  private _consoleMessages: ConsoleMessage[] = [];
  private _requests: pw.Request[] = [];

  readonly actionTimeoutOptions: { timeout?: number };
  readonly navigationTimeoutOptions: { timeout?: number };

  constructor(context: Context, page: pw.Page, onPageClose: (tab: Tab) => void) {
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    this.actionTimeoutOptions = { timeout: context.config.timeouts?.action };
    this.navigationTimeoutOptions = { timeout: context.config.timeouts?.navigation };

    page.on('close', () => this._onClose());

    page.on('dialog', dialog => {
      this._modalStates.push({
        type: 'dialog',
        description: `"${dialog.type()}" dialog: "${dialog.message()}"`,
        dialog,
      });
    });

    page.on('filechooser', fileChooser => {
      this._modalStates.push({
        type: 'fileChooser',
        description: 'File chooser is open',
        fileChooser,
      });
    });

    page.on('console', msg => {
      this._consoleMessages.push({
        type: msg.type(),
        timestamp: Date.now(),
        text: msg.text(),
        toString: () => `[${msg.type().toUpperCase()}] ${msg.text()}`,
      });
    });

    page.on('pageerror', err => {
      this._consoleMessages.push({
        type: 'error',
        timestamp: Date.now(),
        text: err.message,
        toString: () => `[ERROR] ${err.stack ?? err.message}`,
      });
    });

    page.on('request', req => this._requests.push(req));
  }

  async dispose() {}

  isCurrentTab(): boolean {
    return this === this.context.currentTab();
  }

  modalStates(): ModalState[] {
    return this._modalStates;
  }

  clearModalState(state: ModalState) {
    this._modalStates = this._modalStates.filter(s => s !== state);
  }

  consoleMessages(): ConsoleMessage[] {
    return this._consoleMessages;
  }

  clearConsoleMessages() {
    this._consoleMessages = [];
  }

  requests(): pw.Request[] {
    return this._requests;
  }

  clearRequests() {
    this._requests = [];
  }

  private _onClose() {
    this._modalStates = [];
    this._consoleMessages = [];
    this._requests = [];
    this._onPageClose(this);
  }

  async headerSnapshot(): Promise<TabHeader & { changed: boolean }> {
    let title = '';
    const url = this.page.url();
    if (!url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
      try {
        title = await Promise.race([
          this.page.title(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]) as string;
      } catch { /* ignore */ }
    }
    return { title, url, current: this.isCurrentTab(), changed: true };
  }

  async navigate(url: string) {
    this._requests = [];
    this._consoleMessages = [];
    await this.page.goto(url, { waitUntil: 'domcontentloaded', ...this.navigationTimeoutOptions });
    await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  }

  async captureSnapshot(selector: string | undefined): Promise<TabSnapshot | null> {
    const url = this.page.url();
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://'))
      return null;
    try {
      const root = selector ? this.page.locator(selector) : this.page.locator(':root');
      const ariaSnapshot = await Promise.race([
        root.ariaSnapshot(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]) as string;
      return { ariaSnapshot, modalStates: this._modalStates };
    } catch {
      return null;
    }
  }

  async refLocator(params: {
    element?: string;
    ref?: string;
    selector?: string;
  }): Promise<{ locator: pw.Locator; resolved: string }> {
    if (params.selector) {
      const locator = this.page.locator(params.selector);
      return { locator, resolved: `locator(${JSON.stringify(params.selector)})` };
    }
    if (params.ref) {
      const locator = this.page.locator(`aria/${params.ref}`);
      return { locator, resolved: `locator('aria/${params.ref}')` };
    }
    throw new Error('Either ref or selector must be provided');
  }

  async waitForCompletion(callback: () => Promise<void>) {
    await callback();
  }
}
