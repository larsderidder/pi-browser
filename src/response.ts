/**
 * BrowserToolResult - pi-compatible result builder for browser tools.
 *
 * Mirrors the section-building logic from playwright-core Response class
 * but outputs pi's { content, details } shape instead of MCP's CallToolResult.
 */

import type { Context } from './context';

export type PiToolResult = {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  >;
  details: Record<string, any>;
  isError?: boolean;
};

type Section = {
  title: string;
  content: string[];
  isError?: boolean;
  codeframe?: 'yaml' | 'js';
};

export class BrowserToolResult {
  private _results: string[] = [];
  private _errors: string[] = [];
  private _code: string[] = [];
  private _context: Context;
  private _includeSnapshot = false;
  private _imageResults: Array<{ data: Buffer; imageType: 'png' | 'jpeg' }> = [];
  private _isClose = false;

  constructor(context: Context) {
    this._context = context;
  }

  addTextResult(text: string) {
    this._results.push(text);
  }

  addError(error: string) {
    this._errors.push(error);
  }

  addCode(code: string) {
    this._code.push(code);
  }

  setIncludeSnapshot() {
    this._includeSnapshot = true;
  }

  async registerImageResult(data: Buffer, imageType: 'png' | 'jpeg') {
    this._imageResults.push({ data, imageType });
  }

  setClose() {
    this._isClose = true;
  }

  async build(): Promise<PiToolResult> {
    const sections: Section[] = [];

    if (this._errors.length)
      sections.push({ title: 'Error', content: this._errors, isError: true });

    if (this._results.length)
      sections.push({ title: 'Result', content: this._results });

    if (this._code.length)
      sections.push({ title: 'Ran Playwright code', content: this._code, codeframe: 'js' });

    // Tab headers — Playwright-controlled tabs
    const tabHeaders = await Promise.all(
      this._context.tabs().map(tab => tab.headerSnapshot())
    );
    // Also include CDP-only tabs (other windows)
    const cdpHeaders: TabHeader[] = this._context.cdpOnlyTargets().map(t => ({
      title: t.title,
      url: t.url,
      current: false,
    }));
    const allHeaders = [...tabHeaders, ...cdpHeaders];

    if (allHeaders.length > 1)
      sections.push({ title: 'Open tabs', content: renderTabsMarkdown(allHeaders) });

    if (tabHeaders.length > 0) {
      const current = tabHeaders.find(h => h.current) ?? tabHeaders[0];
      sections.push({ title: 'Page', content: renderTabMarkdown(current) });
    }

    if (this._context.tabs().length === 0)
      this._isClose = true;

    // Snapshot
    if (this._includeSnapshot) {
      const currentTab = this._context.currentTab();
      if (currentTab) {
        const tabSnapshot = await currentTab.captureSnapshot(undefined);
        if (tabSnapshot) {
          const snap = tabSnapshot.ariaSnapshotDiff ?? tabSnapshot.ariaSnapshot;
          if (snap)
            sections.push({ title: 'Snapshot', content: [snap], codeframe: 'yaml' });

          if (tabSnapshot.modalStates.length) {
            const modalLines = tabSnapshot.modalStates.map(
              s => `- [${s.description}]: use appropriate tool to handle`
            );
            sections.push({ title: 'Modal state', content: modalLines });
          }
        }
      }
    }

    // Build text
    const lines: string[] = [];
    for (const section of sections) {
      if (!section.content.length) continue;
      lines.push(`### ${section.title}`);
      if (section.codeframe) lines.push(`\`\`\`${section.codeframe}`);
      lines.push(...section.content);
      if (section.codeframe) lines.push('```');
    }

    const content: PiToolResult['content'] = [
      { type: 'text', text: lines.join('\n') },
    ];

    for (const img of this._imageResults) {
      content.push({
        type: 'image',
        data: img.data.toString('base64'),
        mimeType: img.imageType === 'png' ? 'image/png' : 'image/jpeg',
      });
    }

    return {
      content,
      details: {
        tabs: tabHeaders,
        isClose: this._isClose,
      },
      isError: sections.some(s => s.isError),
    };
  }
}

export type TabHeader = {
  title: string;
  url: string;
  current: boolean;
};

function renderTabMarkdown(tab: TabHeader): string[] {
  const lines = [`- Page URL: ${tab.url}`];
  if (tab.title) lines.push(`- Page Title: ${tab.title}`);
  return lines;
}

function renderTabsMarkdown(tabs: TabHeader[]): string[] {
  if (!tabs.length)
    return ['No open tabs. Use browser_navigate to open a URL.'];
  return tabs.map((tab, i) => {
    const cur = tab.current ? ' (current)' : '';
    return `- ${i}:${cur} [${tab.title}](${tab.url})`;
  });
}
