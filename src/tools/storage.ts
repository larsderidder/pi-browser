import fs from 'node:fs';
import { defineTool } from '../tool';

export const storageState = defineTool({
  capability: 'storage',
  schema: {
    name: 'browser_storage_state',
    title: 'Save storage state',
    description: 'Save cookies and localStorage to a JSON file for later reuse with browser_set_storage_state',
    type: 'readOnly',
  },
  handle: async (context, params, result) => {
    const state = await context.browserContext().storageState();
    const json = JSON.stringify(state, null, 2);
    const file = params.filename ?? `storage-state-${Date.now()}.json`;
    await fs.promises.writeFile(file, json, 'utf-8');
    result.addTextResult(`Storage state saved to: ${file}`);
    result.addCode(`await page.context().storageState({ path: '${file}' });`);
  },
});

export const setStorageState = defineTool({
  capability: 'storage',
  schema: {
    name: 'browser_set_storage_state',
    title: 'Restore storage state',
    description: 'Restore cookies and localStorage from a file previously saved with browser_storage_state',
    type: 'action',
  },
  handle: async (context, params, result) => {
    await context.browserContext().addCookies(
      JSON.parse(await fs.promises.readFile(params.filename, 'utf-8')).cookies ?? []
    );
    result.addTextResult(`Storage state restored from: ${params.filename}`);
    result.addCode(`await page.context().setStorageState('${params.filename}');`);
  },
});

export default [storageState, setStorageState];
