import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type BrowserSettings = {
  autoLaunch: boolean;
  toolAutoLaunch: boolean;
  headless: boolean;
};

/** Stores browser preferences separately from Pi's own settings. */
export class BrowserSettingsStore {
  private _pendingUpdate: Promise<void> = Promise.resolve();

  constructor(readonly filename: string) {}

  /** Reads the file on demand so direct edits apply without reloading Pi. */
  async load(): Promise<BrowserSettings> {
    let content: string;
    try {
      content = await fs.readFile(this.filename, 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { autoLaunch: false, toolAutoLaunch: false, headless: false };
      }
      throw new Error(`Cannot read browser settings at ${this.filename}`, { cause: error });
    }

    try {
      const value: unknown = JSON.parse(content);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected a JSON object.');
      }
      const settings: BrowserSettings = { autoLaunch: false, toolAutoLaunch: false, headless: false };
      for (const [key, setting] of Object.entries(value)) {
        if (key !== 'autoLaunch' && key !== 'toolAutoLaunch' && key !== 'headless') {
          throw new Error(`Unknown setting: ${key}`);
        }
        if (typeof setting !== 'boolean') {
          throw new Error(`${key} must be a boolean.`);
        }
        settings[key] = setting;
      }
      return settings;
    } catch (error) {
      throw new Error(`Invalid browser settings at ${this.filename}. Expected autoLaunch, toolAutoLaunch, and headless booleans.`, { cause: error });
    }
  }

  /** Serializes updates within this instance and replaces the file atomically. */
  async update(patch: Partial<BrowserSettings>): Promise<BrowserSettings> {
    const update = this._pendingUpdate.then(async () => {
      const settings = { ...await this.load(), ...patch };
      await fs.mkdir(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        await fs.rename(temporary, this.filename);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return settings;
    });
    this._pendingUpdate = update.then(() => undefined, () => undefined);
    return update;
  }
}
