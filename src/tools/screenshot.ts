import { defineTabTool } from '../tool';

export const screenshot = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    title: 'Take a screenshot',
    description: "Take a screenshot of the current page. You can't interact based on screenshots; use browser_snapshot for that.",
    type: 'readOnly',
  },
  handle: async (tab, params, result) => {
    const imageType: 'png' | 'jpeg' = params.type === 'jpeg' ? 'jpeg' : 'png';
    const options: Record<string, any> = {
      type: imageType,
      scale: 'css',
      ...tab.actionTimeoutOptions,
    };
    if (imageType === 'jpeg') options.quality = 90;
    if (params.fullPage !== undefined) options.fullPage = params.fullPage;

    let data: Buffer;
    let codeTarget: string;
    if (params.selector) {
      const { locator, resolved } = await tab.refLocator({ selector: params.selector });
      data = await locator.screenshot(options);
      codeTarget = `page.${resolved}.screenshot(...)`;
    } else {
      data = await tab.page.screenshot(options);
      codeTarget = 'page.screenshot(...)';
    }

    result.addCode(`// ${codeTarget}`);
    await result.registerImageResult(data, imageType);
  },
});

export default [screenshot];
