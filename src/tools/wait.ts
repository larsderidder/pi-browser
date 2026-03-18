import { defineTool } from '../tool';

export const waitFor = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: 'Wait for text to appear or disappear, or wait a specified number of seconds',
    type: 'assertion',
  },
  handle: async (context, params, result) => {
    if (!params.text && !params.textGone && !params.time)
      throw new Error('Provide at least one of: time, text, textGone');

    if (params.time) {
      await new Promise(f => setTimeout(f, Math.min(30_000, params.time * 1000)));
      result.addCode(`await new Promise(f => setTimeout(f, ${params.time} * 1000));`);
    }

    const tab = context.currentTabOrDie();

    if (params.textGone) {
      const loc = tab.page.getByText(params.textGone).first();
      await loc.waitFor({ state: 'hidden', ...tab.actionTimeoutOptions });
      result.addCode(`await page.getByText(${JSON.stringify(params.textGone)}).first().waitFor({ state: 'hidden' });`);
    }

    if (params.text) {
      const loc = tab.page.getByText(params.text).first();
      await loc.waitFor({ state: 'visible', ...tab.actionTimeoutOptions });
      result.addCode(`await page.getByText(${JSON.stringify(params.text)}).first().waitFor({ state: 'visible' });`);
    }

    result.addTextResult(`Waited for ${params.text ?? params.textGone ?? `${params.time}s`}`);
    result.setIncludeSnapshot();
  },
});

export default [waitFor];
