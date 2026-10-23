import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import browserExtension from '../index';
import { screenshot } from '../src/tools/screenshot';
import { BrowserToolResult } from '../src/response';
import type { Context } from '../src/context';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function makeContext(data = PNG) {
  const pageScreenshot = vi.fn(async () => data);
  const elementScreenshot = vi.fn(async () => data);
  const refLocator = vi.fn(async () => ({
    locator: { screenshot: elementScreenshot },
    resolved: 'locator("#chart")',
  }));
  const tab = {
    actionTimeoutOptions: {},
    page: { screenshot: pageScreenshot },
    refLocator,
  };
  const context = {
    ensureTab: async () => tab,
    tabs: () => [],
    currentTab: () => undefined,
    cdpOnlyTargets: () => [],
  } as unknown as Context;
  return { context, pageScreenshot, elementScreenshot, refLocator };
}

describe('browser_take_screenshot filename', () => {
  const directories: string[] = [];

  async function temporaryDirectory() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-browser-shot-'));
    directories.push(directory);
    return directory;
  }

  afterEach(async () => {
    for (const directory of directories) {
      await fs.rm(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it('exposes an optional non-empty filename in the registered tool schema', () => {
    const registerTool = vi.fn<(tool: { name: string; parameters: unknown }) => void>();
    browserExtension({
      registerTool,
      registerCommand: vi.fn(),
      on: vi.fn(),
    } as unknown as ExtensionAPI);
    const definition = registerTool.mock.calls.find(([tool]) => tool.name === 'browser_take_screenshot')?.[0];

    expect(definition).toMatchObject({
      parameters: { properties: { filename: { type: 'string', minLength: 1 } } },
    });
    expect(definition?.parameters).not.toMatchObject({ required: expect.arrayContaining(['filename']) });
    expect(screenshot.schema.type).toBe('action');
  });

  it.each(['', null, 42])('rejects an invalid filename %j before capturing', async (filename) => {
    const { context, pageScreenshot } = makeContext();
    const result = new BrowserToolResult(context);

    await expect(screenshot.handle(context, { filename }, result)).rejects.toThrow('Filename must be a non-empty string.');
    expect(pageScreenshot).not.toHaveBeenCalled();
  });

  it('creates parent directories, saves the image, and still returns it inline', async () => {
    const directory = await temporaryDirectory();
    const filename = path.join(directory, 'nested', 'shot.png');
    const { context, pageScreenshot } = makeContext();
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, { filename }, result);

    expect(await fs.readFile(filename)).toEqual(PNG);
    expect(pageScreenshot).toHaveBeenCalledWith({ type: 'png', scale: 'css' });
    const built = await result.build();
    expect(built.content).toContainEqual({
      type: 'image', data: PNG.toString('base64'), mimeType: 'image/png',
    });
    expect(built.content[0]).toMatchObject({
      type: 'text', text: expect.stringContaining(`Screenshot saved to ${filename}`),
    });
  });

  it('resolves relative filenames against the working directory', async () => {
    const directory = await temporaryDirectory();
    const target = path.join(directory, 'relative.png');
    const filename = path.relative(process.cwd(), target);
    const { context } = makeContext();
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, { filename }, result);

    expect(await fs.readFile(target)).toEqual(PNG);
    const built = await result.build();
    expect(built.content[0]).toMatchObject({
      type: 'text', text: expect.stringContaining(`Screenshot saved to ${target}`),
    });
  });

  it('keeps returning an inline image without saving when filename is omitted', async () => {
    const { context } = makeContext();
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, {}, result);

    const built = await result.build();
    expect(built.content).toContainEqual({
      type: 'image', data: PNG.toString('base64'), mimeType: 'image/png',
    });
    expect(built.content[0]).toMatchObject({
      type: 'text', text: expect.not.stringContaining('Screenshot saved to'),
    });
  });

  it('saves JPEG bytes and preserves full-page screenshot options', async () => {
    const directory = await temporaryDirectory();
    const filename = path.join(directory, 'shot.jpg');
    const { context, pageScreenshot } = makeContext(JPEG);
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, { filename, type: 'jpeg', fullPage: true }, result);

    expect(await fs.readFile(filename)).toEqual(JPEG);
    expect(pageScreenshot).toHaveBeenCalledWith({
      type: 'jpeg', scale: 'css', quality: 90, fullPage: true,
    });
    const built = await result.build();
    expect(built.content).toContainEqual({
      type: 'image', data: JPEG.toString('base64'), mimeType: 'image/jpeg',
    });
  });

  it('saves element screenshots rather than capturing the whole page', async () => {
    const directory = await temporaryDirectory();
    const filename = path.join(directory, 'chart.png');
    const { context, pageScreenshot, elementScreenshot, refLocator } = makeContext();
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, { filename, selector: '#chart' }, result);

    expect(await fs.readFile(filename)).toEqual(PNG);
    expect(refLocator).toHaveBeenCalledWith({ selector: '#chart' });
    expect(elementScreenshot).toHaveBeenCalledWith({ type: 'png', scale: 'css' });
    expect(pageScreenshot).not.toHaveBeenCalled();
  });

  it('overwrites an existing screenshot at the requested filename', async () => {
    const directory = await temporaryDirectory();
    const filename = path.join(directory, 'shot.png');
    await fs.writeFile(filename, 'old screenshot');
    const { context } = makeContext();
    const result = new BrowserToolResult(context);

    await screenshot.handle(context, { filename }, result);

    expect(await fs.readFile(filename)).toEqual(PNG);
  });

  it('propagates write errors without reporting a successful save', async () => {
    const directory = await temporaryDirectory();
    const { context } = makeContext();
    const result = new BrowserToolResult(context);

    await expect(screenshot.handle(context, { filename: directory }, result)).rejects.toThrow();

    const built = await result.build();
    expect(built.content[0]).toMatchObject({
      type: 'text', text: expect.not.stringContaining('Screenshot saved to'),
    });
  });
});
