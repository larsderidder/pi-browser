import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserSettingsStore } from '../src/settings';

describe('browser settings', () => {
  let directory: string;
  let filename: string;
  let store: BrowserSettingsStore;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-browser-settings-'));
    filename = path.join(directory, 'agent', 'pi-browser.json');
    store = new BrowserSettingsStore(filename);
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('defaults to disabled auto-launch and headed launches without creating a file', async () => {
    expect(await store.load()).toEqual({ autoLaunch: false, headless: false });
    await expect(fs.access(filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('persists changes while preserving the other setting', async () => {
    await store.update({ headless: true });
    expect(await store.update({ autoLaunch: true })).toEqual({ autoLaunch: true, headless: true });
    expect(await new BrowserSettingsStore(filename).load()).toEqual({ autoLaunch: true, headless: true });
    expect(JSON.parse(await fs.readFile(filename, 'utf8'))).toEqual({ autoLaunch: true, headless: true });
    expect(await fs.readdir(path.dirname(filename))).toEqual(['pi-browser.json']);
  });

  it('reads direct file edits on the next load and defaults omitted settings', async () => {
    await store.update({ autoLaunch: true });
    await fs.writeFile(filename, JSON.stringify({ headless: true }));
    expect(await store.load()).toEqual({ autoLaunch: false, headless: true });
  });

  it('serializes updates so concurrent setting changes are not lost', async () => {
    await Promise.all([store.update({ autoLaunch: true }), store.update({ headless: true })]);
    expect(await store.load()).toEqual({ autoLaunch: true, headless: true });
  });

  it.each(['{', 'null', '[]', 'true', '{"autoLaunch":"true"}', '{"headless":1}', '{"autolaunch":true}'])('rejects invalid configuration %s without replacing it', async (content) => {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content);

    await expect(store.load()).rejects.toThrow(filename);
    await expect(store.update({ autoLaunch: true })).rejects.toThrow(filename);
    expect(await fs.readFile(filename, 'utf8')).toBe(content);
  });

  it('does not treat read failures as missing configuration', async () => {
    await fs.mkdir(filename, { recursive: true });
    await expect(store.load()).rejects.toThrow(filename);
  });

  it('can save after an earlier update failed', async () => {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, '{');
    await expect(store.update({ autoLaunch: true })).rejects.toThrow();
    await fs.writeFile(filename, '{}');
    expect(await store.update({ autoLaunch: true })).toEqual({ autoLaunch: true, headless: false });
  });
});
