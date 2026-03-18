import { defineTabTool } from '../tool';

export const mouseMove = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_move_xy', title: 'Move mouse', description: 'Move mouse to an absolute x/y coordinate', type: 'input' },
  handle: async (tab, params, result) => {
    await tab.waitForCompletion(async () => { await tab.page.mouse.move(params.x, params.y); });
    result.addCode(`await page.mouse.move(${params.x}, ${params.y});`);
  },
});

export const mouseDown = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_down', title: 'Mouse down', description: 'Press mouse button down', type: 'input' },
  handle: async (tab, params, result) => {
    const opts = params.button ? { button: params.button } : {};
    await tab.page.mouse.down(opts);
    result.addCode(`await page.mouse.down(${params.button ? `{ button: '${params.button}' }` : ''});`);
  },
});

export const mouseUp = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_up', title: 'Mouse up', description: 'Release mouse button', type: 'input' },
  handle: async (tab, params, result) => {
    const opts = params.button ? { button: params.button } : {};
    await tab.page.mouse.up(opts);
    result.addCode(`await page.mouse.up(${params.button ? `{ button: '${params.button}' }` : ''});`);
  },
});

export const mouseWheel = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_wheel', title: 'Scroll mouse wheel', description: 'Scroll the mouse wheel by deltaX/deltaY pixels', type: 'input' },
  handle: async (tab, params, result) => {
    await tab.page.mouse.wheel(params.deltaX ?? 0, params.deltaY ?? 0);
    result.addCode(`await page.mouse.wheel(${params.deltaX ?? 0}, ${params.deltaY ?? 0});`);
  },
});

export const mouseClickXY = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_click_xy', title: 'Click at coordinates', description: 'Click at an absolute x/y coordinate. Use browser_click with a ref/selector when possible.', type: 'input' },
  handle: async (tab, params, result) => {
    const opts: Record<string, any> = {};
    if (params.button) opts.button = params.button;
    if (params.clickCount) opts.clickCount = params.clickCount;
    if (params.delay) opts.delay = params.delay;
    await tab.waitForCompletion(async () => { await tab.page.mouse.click(params.x, params.y, opts); });
    result.addCode(`await page.mouse.click(${params.x}, ${params.y}${Object.keys(opts).length ? ', ' + JSON.stringify(opts) : ''});`);
    result.setIncludeSnapshot();
  },
});

export const mouseDragXY = defineTabTool({
  capability: 'vision',
  schema: { name: 'browser_mouse_drag_xy', title: 'Drag between coordinates', description: 'Drag from one x/y coordinate to another', type: 'input' },
  handle: async (tab, params, result) => {
    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.startX, params.startY);
      await tab.page.mouse.down();
      await tab.page.mouse.move(params.endX, params.endY);
      await tab.page.mouse.up();
    });
    result.addCode(`await page.mouse.move(${params.startX}, ${params.startY});\nawait page.mouse.down();\nawait page.mouse.move(${params.endX}, ${params.endY});\nawait page.mouse.up();`);
    result.setIncludeSnapshot();
  },
});

export default [mouseMove, mouseClickXY, mouseDragXY, mouseDown, mouseUp, mouseWheel];
