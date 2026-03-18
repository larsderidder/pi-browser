import { defineTool } from '../tool';

export const cookieList = defineTool({
  capability: 'storage',
  schema: { name: 'browser_cookie_list', title: 'List cookies', description: 'List all cookies, optionally filtered by domain or path', type: 'readOnly' },
  handle: async (context, params, result) => {
    let cookies = await context.browserContext().cookies();
    if (params.domain) cookies = cookies.filter(c => c.domain.includes(params.domain));
    if (params.path) cookies = cookies.filter(c => c.path.startsWith(params.path));
    result.addTextResult(cookies.length
      ? cookies.map(c => `${c.name}=${c.value} (domain: ${c.domain}, path: ${c.path})`).join('\n')
      : 'No cookies found.');
  },
});

export const cookieGet = defineTool({
  capability: 'storage',
  schema: { name: 'browser_cookie_get', title: 'Get cookie', description: 'Get a specific cookie by name', type: 'readOnly' },
  handle: async (context, params, result) => {
    const cookies = await context.browserContext().cookies();
    const c = cookies.find(c => c.name === params.name);
    result.addTextResult(c
      ? `${c.name}=${c.value} (domain: ${c.domain}, path: ${c.path}, httpOnly: ${c.httpOnly}, secure: ${c.secure})`
      : `Cookie '${params.name}' not found.`);
  },
});

export const cookieSet = defineTool({
  capability: 'storage',
  schema: { name: 'browser_cookie_set', title: 'Set cookie', description: 'Set a cookie', type: 'action' },
  handle: async (context, params, result) => {
    const tab = await context.ensureTab();
    const url = new URL(tab.page.url());
    const cookie: any = {
      name: params.name,
      value: params.value,
      domain: params.domain ?? url.hostname,
      path: params.path ?? '/',
    };
    if (params.expires !== undefined) cookie.expires = params.expires;
    if (params.httpOnly !== undefined) cookie.httpOnly = params.httpOnly;
    if (params.secure !== undefined) cookie.secure = params.secure;
    if (params.sameSite !== undefined) cookie.sameSite = params.sameSite;
    await context.browserContext().addCookies([cookie]);
    result.addTextResult(`Cookie '${params.name}' set.`);
    result.addCode(`await page.context().addCookies([${JSON.stringify(cookie)}]);`);
  },
});

export const cookieDelete = defineTool({
  capability: 'storage',
  schema: { name: 'browser_cookie_delete', title: 'Delete cookie', description: 'Delete a specific cookie by name', type: 'action' },
  handle: async (context, params, result) => {
    await context.browserContext().clearCookies({ name: params.name });
    result.addTextResult(`Cookie '${params.name}' deleted.`);
    result.addCode(`await page.context().clearCookies({ name: '${params.name}' });`);
  },
});

export const cookieClear = defineTool({
  capability: 'storage',
  schema: { name: 'browser_cookie_clear', title: 'Clear cookies', description: 'Clear all cookies', type: 'action' },
  handle: async (context, _params, result) => {
    await context.browserContext().clearCookies();
    result.addTextResult('All cookies cleared.');
    result.addCode(`await page.context().clearCookies();`);
  },
});

export default [cookieList, cookieGet, cookieSet, cookieDelete, cookieClear];
