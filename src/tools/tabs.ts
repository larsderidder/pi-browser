import { defineTool } from '../tool';

export const browserTabs = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tabs',
    title: 'Manage tabs',
    description: 'List, create, close, or select a browser tab',
    type: 'action',
  },
  handle: async (context, params, result) => {
    switch (params.action) {
      case 'list':
        // No ensureTab here — just list what we have, including CDP-only tabs
        break;
      case 'new':
        await context.newTab();
        break;
      case 'close':
        await context.closeTab(params.index);
        break;
      case 'select':
        if (params.index === undefined) throw new Error('Tab index is required for select');
        await context.selectTab(params.index);
        break;
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    const allInfos = context.allTabInfos();
    if (!allInfos.length) {
      result.addTextResult('No open tabs.');
      return;
    }

    const lines = await Promise.all(allInfos.map(async info => {
      if (info.tab) {
        const h = await info.tab.headerSnapshot();
        const cur = h.current ? ' (current)' : '';
        return `- ${info.index}:${cur} [${h.title || 'blank'}](${h.url})`;
      } else {
        const t = info.cdpTarget!;
        return `- ${info.index}: [${t.title || 'blank'}](${t.url}) ⚠️ different window — select to switch`;
      }
    }));

    result.addTextResult(lines.join('\n'));
  },
});

export default [browserTabs];
