import { defineTool, defineTabTool } from '../tool';
import type * as pw from 'playwright';

function isFetch(req: pw.Request): boolean {
  return ['fetch', 'xhr'].includes(req.resourceType());
}

function isSuccessful(req: pw.Request): boolean {
  if (req.failure()) return false;
  return !!req.timing().responseStart;
}

async function renderRequest(req: pw.Request, includeBody: boolean, includeHeaders: boolean): Promise<string> {
  const res = await req.response();
  const lines: string[] = [];
  lines.push(`[${req.method()}] ${req.url()}`);
  if (res) {
    lines.push(` => [${res.status()}] ${res.statusText()}`);
  } else if (req.failure()) {
    lines.push(` => [FAILED] ${req.failure()?.errorText ?? 'unknown'}`);
  }
  if (includeHeaders) {
    const headers = req.headers();
    const hLines = Object.entries(headers).map(([k, v]) => `    ${k}: ${v}`).join('\n');
    if (hLines) lines.push(`\n  Request headers:\n${hLines}`);
  }
  if (includeBody) {
    const body = req.postData();
    if (body) lines.push(`\n  Request body: ${body}`);
  }
  return lines.join('');
}

export const networkRequests = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'List network requests made by the current page since last navigation. Useful for debugging API calls and failed requests.',
    type: 'readOnly',
  },
  handle: async (tab, params, result) => {
    const allReqs = tab.requests();
    const filter = params.filter ? new RegExp(params.filter) : undefined;
    const lines: string[] = [];
    for (const req of allReqs) {
      if (!params.static && !isFetch(req) && isSuccessful(req)) continue;
      if (filter && !filter.test(req.url())) continue;
      lines.push(await renderRequest(req, params.requestBody ?? false, params.requestHeaders ?? false));
    }
    const MAX = 20_000;
    let text = lines.join('\n') || 'No matching requests.';
    if (text.length > MAX)
      text = text.slice(0, MAX) + `\n[truncated, ${lines.length} requests total]`;
    result.addTextResult(text);
  },
});

export const networkClear = defineTabTool({
  capability: 'core',
  schema: { name: 'browser_network_clear', title: 'Clear network requests', description: 'Clear recorded network requests', type: 'action' },
  handle: async (tab, _params, result) => {
    tab.clearRequests();
    result.addTextResult('Network requests cleared.');
  },
});

export const networkStateSet = defineTool({
  capability: 'network',
  schema: {
    name: 'browser_network_state_set',
    title: 'Set network state',
    description: 'Set the browser to online or offline mode',
    type: 'action',
  },
  handle: async (context, params, result) => {
    await context.browserContext().setOffline(params.state === 'offline');
    result.addTextResult(`Network is now ${params.state}.`);
    result.addCode(`await page.context().setOffline(${params.state === 'offline'});`);
  },
});

export default [networkRequests, networkClear, networkStateSet];
