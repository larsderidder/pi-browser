import { defineTool } from '../tool';
import type * as pw from 'playwright';
import type { RouteEntry } from '../context';

export const route = defineTool({
  capability: 'network',
  schema: {
    name: 'browser_route',
    title: 'Mock network requests',
    description: 'Intercept and mock network requests matching a URL pattern',
    type: 'action',
  },
  handle: async (context, params, result) => {
    const addHeaders = params.headers
      ? Object.fromEntries((params.headers as string[]).map((h: string) => {
          const i = h.indexOf(':');
          return [h.slice(0, i).trim(), h.slice(i + 1).trim()];
        }))
      : undefined;
    const removeHeaders = params.removeHeaders
      ? (params.removeHeaders as string).split(',').map((h: string) => h.trim())
      : undefined;

    const handler = async (r: pw.Route) => {
      if (params.body !== undefined || params.status !== undefined) {
        await r.fulfill({ status: params.status ?? 200, contentType: params.contentType, body: params.body });
        return;
      }
      const headers = { ...r.request().headers() };
      if (addHeaders) Object.assign(headers, addHeaders);
      if (removeHeaders) for (const h of removeHeaders) delete headers[h.toLowerCase()];
      await r.continue({ headers });
    };

    const entry: RouteEntry = {
      pattern: params.pattern,
      status: params.status,
      body: params.body,
      contentType: params.contentType,
      addHeaders,
      removeHeaders,
      handler,
    };

    await context.addRoute(entry);
    result.addTextResult(`Route added for: ${params.pattern}`);
    result.addCode(`await page.context().route('${params.pattern}', route => { /* handler */ });`);
  },
});

export const routeList = defineTool({
  capability: 'network',
  schema: { name: 'browser_route_list', title: 'List routes', description: 'List all active network routes', type: 'readOnly' },
  handle: async (context, _params, result) => {
    const routes = context.routes();
    if (!routes.length) { result.addTextResult('No active routes.'); return; }
    result.addTextResult(routes.map((r, i) => `${i + 1}. ${r.pattern}`).join('\n'));
  },
});

export const unroute = defineTool({
  capability: 'network',
  schema: { name: 'browser_unroute', title: 'Remove routes', description: 'Remove network routes matching a pattern, or all routes if no pattern given', type: 'action' },
  handle: async (context, params, result) => {
    const removed = await context.removeRoute(params.pattern);
    result.addTextResult(`Removed ${removed} route(s)${params.pattern ? ` for pattern: ${params.pattern}` : ''}.`);
  },
});

export default [route, routeList, unroute];
