import { defineTool, defineTabTool } from '../tool';

export const close = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_close',
    title: 'Close browser',
    description: 'Close the current page',
    type: 'action',
  },
  handle: async (_context, _params, result) => {
    result.addCode('await page.close();');
    result.setClose();
    result.addTextResult('Page closed.');
  },
});

export const resize = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    title: 'Resize browser window',
    description: 'Resize the browser window to the given width and height',
    type: 'action',
  },
  handle: async (tab, params, result) => {
    await tab.page.setViewportSize({ width: params.width, height: params.height });
    result.addCode(`await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`);
    result.addTextResult(`Resized to ${params.width}x${params.height}`);
  },
});

export default [close, resize];
