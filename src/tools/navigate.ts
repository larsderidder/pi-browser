import { defineTool, defineTabTool } from '../tool';

export const navigate = defineTool({
  capability: 'core-navigation',
  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    type: 'action',
  },
  handle: async (context, params, result) => {
    const tab = await context.ensureTab();
    let url: string = params.url;
    try { new URL(url); } catch {
      url = url.startsWith('localhost') ? 'http://' + url : 'https://' + url;
    }
    await tab.navigate(url);
    result.addCode(`await page.goto('${url}');`);
    result.setIncludeSnapshot();
  },
});

export const goBack = defineTabTool({
  capability: 'core-navigation',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: 'Go back to the previous page in the history',
    type: 'action',
  },
  handle: async (tab, _params, result) => {
    await tab.page.goBack(tab.navigationTimeoutOptions);
    result.addCode('await page.goBack();');
    result.setIncludeSnapshot();
  },
});

export const reload = defineTabTool({
  capability: 'core-navigation',
  schema: {
    name: 'browser_reload',
    title: 'Reload the page',
    description: 'Reload the current page',
    type: 'action',
  },
  handle: async (tab, _params, result) => {
    await tab.page.reload(tab.navigationTimeoutOptions);
    result.addCode('await page.reload();');
    result.setIncludeSnapshot();
  },
});

export default [navigate, goBack, reload];
