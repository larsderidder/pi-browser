import { defineTabTool } from '../tool';

export const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: 'Evaluate a JavaScript expression on the page or a specific element',
    type: 'action',
  },
  handle: async (tab, params, result) => {
    let expr: string = params.function;
    if (!expr.includes('=>')) expr = `() => (${expr})`;

    await tab.waitForCompletion(async () => {
      // eslint-disable-next-line no-new-func
      const fn = new Function() as any;
      fn.toString = () => expr;

      const timeoutMs = tab.actionTimeoutOptions.timeout ?? 10000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`evaluate timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      let value: any;
      if (params.ref || params.selector) {
        const { locator, resolved } = await tab.refLocator({
          ref: params.ref,
          selector: params.selector,
          element: params.element,
        });
        value = await Promise.race([locator.evaluate(fn), timeout]);
        result.addCode(`await page.${resolved}.evaluate(${JSON.stringify(expr)});`);
      } else {
        value = await Promise.race([tab.page.evaluate(fn), timeout]);
        result.addCode(`await page.evaluate(${JSON.stringify(expr)});`);
      }

      result.addTextResult(JSON.stringify(value, null, 2) ?? 'undefined');
    });
  },
});

export default [evaluate];
