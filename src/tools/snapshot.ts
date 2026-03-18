import { defineTool, defineTabTool } from '../tool';

const MAX_SNAPSHOT_BYTES = 20_000;

export const snapshot = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: [
      'Capture the accessibility tree of the current page to identify elements for interaction.',
      'Use this to find element refs before clicking, typing, or filling forms.',
      'Do NOT call this after every action to confirm results — check the snapshot included in action responses instead.',
      'Output is truncated to ~20KB. Use the selector param to scope to a specific part of the page if the full snapshot is too large.',
    ].join(' '),
    type: 'readOnly',
  },
  handle: async (context, params, result) => {
    await context.ensureTab();
    const tab = context.currentTabOrDie();
    const snap = await tab.captureSnapshot(params.selector);
    if (!snap?.ariaSnapshot) {
      result.addTextResult('(empty snapshot)');
      return;
    }
    let text = snap.ariaSnapshot;
    if (Buffer.byteLength(text, 'utf8') > MAX_SNAPSHOT_BYTES) {
      // Truncate to byte limit on a line boundary
      const buf = Buffer.from(text, 'utf8').subarray(0, MAX_SNAPSHOT_BYTES);
      text = buf.toString('utf8').replace(/\n[^\n]*$/, ''); // trim partial last line
      const totalKB = Math.round(Buffer.byteLength(snap.ariaSnapshot, 'utf8') / 1024);
      text += `\n\n[Snapshot truncated at 20KB (total: ~${totalKB}KB). Use the selector param to scope to a specific section.]`;
    }
    result.addTextResult(text);
  },
});

export const click = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform a click on a web page element',
    type: 'input',
  },
  handle: async (tab, params, result) => {
    const { locator, resolved } = await tab.refLocator(params);
    const options: Record<string, any> = {};
    if (params.button) options.button = params.button;
    if (params.modifiers) options.modifiers = params.modifiers;
    if (Object.keys(options).length > 0)
      Object.assign(options, tab.actionTimeoutOptions);
    else
      Object.assign(options, tab.actionTimeoutOptions);

    if (params.doubleClick) {
      await tab.waitForCompletion(() => locator.dblclick(options));
      result.addCode(`await page.${resolved}.dblclick();`);
    } else {
      await tab.waitForCompletion(() => locator.click(options));
      result.addCode(`await page.${resolved}.click();`);
    }
    result.setIncludeSnapshot();
  },
});

export const hover = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_hover',
    title: 'Hover mouse',
    description: 'Hover over an element on the page',
    type: 'input',
  },
  handle: async (tab, params, result) => {
    const { locator, resolved } = await tab.refLocator(params);
    await tab.waitForCompletion(() => locator.hover(tab.actionTimeoutOptions));
    result.addCode(`await page.${resolved}.hover();`);
    result.setIncludeSnapshot();
  },
});

export const selectOption = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_select_option',
    title: 'Select option',
    description: 'Select an option in a dropdown',
    type: 'input',
  },
  handle: async (tab, params, result) => {
    const { locator, resolved } = await tab.refLocator(params);
    await tab.waitForCompletion(async () => { await locator.selectOption(params.values, tab.actionTimeoutOptions); });
    result.addCode(`await page.${resolved}.selectOption(${JSON.stringify(params.values)});`);
    result.setIncludeSnapshot();
  },
});

export const drag = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_drag',
    title: 'Drag mouse',
    description: 'Perform drag and drop between two elements',
    type: 'input',
  },
  handle: async (tab, params, result) => {
    const start = await tab.refLocator({ ref: params.startRef, selector: params.startSelector, element: params.startElement });
    const end = await tab.refLocator({ ref: params.endRef, selector: params.endSelector, element: params.endElement });
    await tab.waitForCompletion(async () => { await start.locator.dragTo(end.locator, tab.actionTimeoutOptions); return; });
    result.addCode(`await page.${start.resolved}.dragTo(page.${end.resolved});`);
    result.setIncludeSnapshot();
  },
});

export default [snapshot, click, hover, selectOption, drag];
