import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import * as pw from 'playwright';
import browserExtension from '../index';

vi.mock('@earendil-works/pi-coding-agent', () => ({ getAgentDir: vi.fn() }));
vi.mock('playwright', () => ({
  chromium: { launchPersistentContext: vi.fn(), connectOverCDP: vi.fn() },
  firefox: { launchPersistentContext: vi.fn() },
  webkit: { launchPersistentContext: vi.fn() },
}));

type RegisteredTool = {
  name: string;
  execute: (id: string, params: Record<string, unknown>) => Promise<unknown>;
};

function registerExtension() {
  const registerTool = vi.fn<(tool: RegisteredTool) => void>();
  const registerCommand = vi.fn<ExtensionAPI['registerCommand']>();
  const on = vi.fn<(event: string, handler: () => Promise<void>) => void>();
  const notify = vi.fn();
  browserExtension({ registerTool, registerCommand, on } as unknown as ExtensionAPI);
  const command = registerCommand.mock.calls.find(([name]) => name === 'browser')![1];
  const context = { ui: { notify } } as unknown as ExtensionCommandContext;
  return {
    notify,
    shutdown: async () => on.mock.calls.find(([event]) => event === 'session_shutdown')![1](),
    command: async (args: string) => command.handler(args, context),
    tool: async () => {
      const tool = registerTool.mock.calls.find(([tool]) => tool.name === 'browser_tabs')![0];
      return tool.execute('test', { action: 'list' });
    },
  };
}

describe('browser auto-launch configuration', () => {
  let directory: string;
  let filename: string;
  let browser: {
    isConnected: ReturnType<typeof vi.fn>;
    contexts: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
  let browserContext: pw.BrowserContext;

  beforeEach(async () => {
    vi.resetAllMocks();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-browser-command-'));
    filename = path.join(directory, 'pi-browser.json');
    vi.mocked(getAgentDir).mockReturnValue(directory);
    browser = {
      isConnected: vi.fn(() => true), contexts: vi.fn(), close: vi.fn(), on: vi.fn(),
    };
    browserContext = {
      browser: () => browser, pages: () => [], on: vi.fn(),
    } as unknown as pw.BrowserContext;
    browser.contexts.mockReturnValue([browserContext]);
    vi.mocked(pw.chromium.launchPersistentContext).mockResolvedValue(browserContext);
    vi.mocked(pw.firefox.launchPersistentContext).mockResolvedValue(browserContext);
    vi.mocked(pw.chromium.connectOverCDP).mockResolvedValue(browser as unknown as pw.Browser);
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => [] })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('does not auto-launch or create configuration by default', async () => {
    const extension = registerExtension();
    await expect(extension.tool()).rejects.toThrow('Browser not connected');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
    await expect(fs.access(filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps tools from launching when only connect auto-launch is enabled', async () => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true }));
    await expect(registerExtension().tool()).rejects.toThrow('Browser not connected');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('launches on connect failure when command auto-launch is enabled', async () => {
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    const extension = registerExtension();
    await extension.command('auto-launch on');
    await expect(extension.tool()).rejects.toThrow('Browser not connected');
    await extension.command('connect');
    expect(pw.chromium.connectOverCDP).toHaveBeenCalledWith('http://localhost:9222');
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledWith('', expect.objectContaining({ headless: false }));
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Connected to launched Chromium'), 'info');
    await extension.tool();
    await extension.command('disconnect');
    await expect(extension.tool()).rejects.toThrow('Browser not connected');
  });

  it('honors file configuration and headless mode for the connect fallback', async () => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true, headless: true }));
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    await registerExtension().command('connect 9223');
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledWith('', expect.objectContaining({ headless: true }));
  });

  it('does not launch on connect failure by default', async () => {
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    const extension = registerExtension();
    await extension.command('connect');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'), 'error');
  });

  it('does not use tool auto-launch as permission for the connect fallback', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    const extension = registerExtension();
    await extension.command('connect');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'), 'error');
  });

  it('reuses an established connection when connect is repeated without a port', async () => {
    const extension = registerExtension();
    await extension.command('connect');
    await extension.command('connect');
    expect(pw.chromium.connectOverCDP).toHaveBeenCalledTimes(1);
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('reports fallback launch failures rather than claiming a connection succeeded', async () => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true }));
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    vi.mocked(pw.chromium.launchPersistentContext).mockRejectedValue(new Error('Browser executable missing'));
    const extension = registerExtension();
    await extension.command('connect');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Browser executable missing'), 'error');
    expect(extension.notify).not.toHaveBeenCalledWith(expect.stringContaining('Connected to launched Chromium'), 'info');
  });

  it('fails closed on invalid configuration after a failed attach', async () => {
    await fs.writeFile(filename, '{"autoLaunch":"true"}');
    vi.mocked(pw.chromium.connectOverCDP).mockRejectedValue(new Error('ECONNREFUSED'));
    const extension = registerExtension();
    await extension.command('connect');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining(filename), 'error');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it.each(['connect nope', 'connect 9222wrong', 'connect 0', 'connect 65536', 'connect 9222 extra'])('rejects invalid connection commands without launching: %s', async (args) => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true }));
    const extension = registerExtension();
    await extension.command(args);
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Usage:'), 'error');
    expect(pw.chromium.connectOverCDP).not.toHaveBeenCalled();
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('launches headed Chromium lazily when enabled in the file', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    const extension = registerExtension();
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();

    await extension.tool();
    await extension.tool();

    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledExactlyOnceWith('', expect.objectContaining({ headless: false }));
  });

  it('honors headless configuration for automatic launches', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true, headless: true }));
    await registerExtension().tool();
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledWith('', expect.objectContaining({ headless: true }));
  });

  it('always reuses an explicitly connected browser', async () => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true }));
    const extension = registerExtension();
    await extension.command('connect 9223');
    await extension.tool();
    expect(pw.chromium.connectOverCDP).toHaveBeenCalledWith('http://localhost:9223');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('waits for an in-flight explicit connection instead of launching a replacement', async () => {
    await fs.writeFile(filename, JSON.stringify({ autoLaunch: true }));
    let finishConnect!: (browser: pw.Browser) => void;
    vi.mocked(pw.chromium.connectOverCDP).mockReturnValueOnce(new Promise(resolve => { finishConnect = resolve; }));
    const extension = registerExtension();
    const connect = extension.command('connect 9223');
    await vi.waitFor(() => expect(pw.chromium.connectOverCDP).toHaveBeenCalledTimes(1));
    const tool = extension.tool();
    finishConnect(browser as unknown as pw.Browser);
    await Promise.all([connect, tool]);
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('shares one in-flight launch between concurrent tool calls', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    let finishLaunch!: (context: pw.BrowserContext) => void;
    vi.mocked(pw.chromium.launchPersistentContext).mockReturnValueOnce(new Promise(resolve => { finishLaunch = resolve; }));
    const extension = registerExtension();
    const tools = Promise.allSettled([extension.tool(), extension.tool()]);
    await vi.waitFor(() => expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1));
    finishLaunch(browserContext);
    expect(await tools).toMatchObject([{ status: 'fulfilled' }, { status: 'fulfilled' }]);
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1);
  });

  it('can auto-launch again after a launched browser is closed externally', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    const extension = registerExtension();
    await extension.tool();
    const handler = browser.on.mock.calls.find(([event]) => event === 'disconnected')?.[1];
    expect(handler).toBeDefined();
    handler();
    await extension.tool();
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(2);
  });

  it('waits for an automatic launch before disconnecting', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    let finishLaunch!: (context: pw.BrowserContext) => void;
    vi.mocked(pw.chromium.launchPersistentContext).mockReturnValueOnce(new Promise(resolve => { finishLaunch = resolve; }));
    const extension = registerExtension();
    const tool = extension.tool();
    await vi.waitFor(() => expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1));
    const disconnect = extension.command('disconnect');
    expect(browser.close).not.toHaveBeenCalled();
    finishLaunch(browserContext);
    await Promise.allSettled([tool, disconnect]);
    await expect(disconnect).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('waits for an automatic launch during shutdown so the browser is not orphaned', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    let finishLaunch!: (context: pw.BrowserContext) => void;
    vi.mocked(pw.chromium.launchPersistentContext).mockReturnValueOnce(new Promise(resolve => { finishLaunch = resolve; }));
    const extension = registerExtension();
    const tool = extension.tool();
    await vi.waitFor(() => expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1));
    const shutdown = extension.shutdown();
    expect(browser.close).not.toHaveBeenCalled();
    finishLaunch(browserContext);
    await Promise.allSettled([tool, shutdown]);
    await expect(shutdown).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('allows another attempt after a launch fails', async () => {
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true }));
    vi.mocked(pw.chromium.launchPersistentContext).mockRejectedValueOnce(new Error('Browser executable missing'));
    const extension = registerExtension();
    await expect(extension.tool()).rejects.toThrow('Browser executable missing');
    await extension.tool();
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(2);
  });

  it('fails closed on invalid configuration instead of launching', async () => {
    await fs.writeFile(filename, '{"autoLaunch":"true"}');
    await expect(registerExtension().tool()).rejects.toThrow(filename);
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('persists tool auto-launch changes without launching until a tool needs a browser', async () => {
    const extension = registerExtension();
    await extension.command('tool-auto-launch on');
    expect(JSON.parse(await fs.readFile(filename, 'utf8'))).toEqual({ autoLaunch: false, toolAutoLaunch: true, headless: false });
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
    await extension.tool();
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1);
  });

  it('disabling tool auto-launch keeps an existing browser, but prevents relaunch after disconnect', async () => {
    const extension = registerExtension();
    await extension.command('tool-auto-launch on');
    await extension.tool();
    await extension.command('tool-auto-launch off');
    expect(browser.close).not.toHaveBeenCalled();
    await extension.tool();
    await extension.command('disconnect');
    await expect(extension.tool()).rejects.toThrow('Browser not connected');
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledTimes(1);
  });

  it('persists headless changes and applies them to explicit Firefox launches', async () => {
    const extension = registerExtension();
    await extension.command('headless on');
    await extension.command('launch firefox');
    expect(pw.firefox.launchPersistentContext).toHaveBeenCalledWith('', expect.objectContaining({ headless: true }));
    expect(JSON.parse(await fs.readFile(filename, 'utf8'))).toEqual({ autoLaunch: false, toolAutoLaunch: false, headless: true });
  });

  it('reads direct file edits before the next disconnected tool call', async () => {
    const extension = registerExtension();
    await expect(extension.tool()).rejects.toThrow('Browser not connected');
    await fs.writeFile(filename, JSON.stringify({ toolAutoLaunch: true, headless: true }));
    await extension.tool();
    expect(pw.chromium.launchPersistentContext).toHaveBeenCalledWith('', expect.objectContaining({ headless: true }));
  });

  it('reports settings and their file path without opening a browser', async () => {
    const extension = registerExtension();
    await extension.command('status');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Auto-launch: off'), 'info');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Tool auto-launch: off'), 'info');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Headless: off'), 'info');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining(filename), 'info');
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('shows an individual setting without writing configuration', async () => {
    const extension = registerExtension();
    await extension.command('auto-launch');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Auto-launch: off'), 'info');
    await extension.command('tool-auto-launch');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Tool auto-launch: off'), 'info');
    await extension.command('headless');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Headless: off'), 'info');
    await expect(fs.access(filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['auto-launch yes', 'auto-launch on extra', 'tool-auto-launch yes', 'headless yes'])('rejects invalid setting commands: %s', async (args) => {
    const extension = registerExtension();
    await extension.command(args);
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining('Usage:'), 'error');
    await expect(fs.access(filename)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(pw.chromium.launchPersistentContext).not.toHaveBeenCalled();
  });

  it('reports configuration errors without claiming a setting was saved', async () => {
    await fs.writeFile(filename, '{');
    const extension = registerExtension();
    await extension.command('auto-launch on');
    expect(extension.notify).toHaveBeenCalledWith(expect.stringContaining(filename), 'error');
    expect(await fs.readFile(filename, 'utf8')).toBe('{');
  });
});
