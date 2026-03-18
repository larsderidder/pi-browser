import { defineTabTool } from '../tool';

export const type = defineTabTool({
  capability: 'core-input',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: `Type text into an editable element.

**Fallback for reactive frameworks (Vue, React, etc.):** If this tool fails or the text
does not bind (e.g. the field appears filled but the framework state is not updated),
use \`browser_evaluate\` instead:

\`\`\`js
() => {
  const el = document.querySelector('your-selector');
  el.focus();
  document.execCommand('insertText', false, 'your text');
  return el.value;
}
\`\`\`

\`document.execCommand('insertText')\` fires the native input event that reactive frameworks
listen to, whereas \`locator.fill()\` sets the DOM value directly and may bypass framework
reactivity. Use \`execCommand\` as the fallback whenever \`browser_type\` or \`browser_fill_form\`
silently fails on a reactive app.`,
    type: 'input',
  },
  handle: async (tab, params, result) => {
    const { locator, resolved } = await tab.refLocator(params);
    await tab.waitForCompletion(async () => {
      if (params.slowly) {
        await locator.pressSequentially(params.text, tab.actionTimeoutOptions);
        result.addCode(`await page.${resolved}.pressSequentially(${JSON.stringify(params.text)});`);
      } else {
        await locator.fill(params.text, tab.actionTimeoutOptions);
        result.addCode(`await page.${resolved}.fill(${JSON.stringify(params.text)});`);
      }
      if (params.submit) {
        await locator.press('Enter', tab.actionTimeoutOptions);
        result.addCode(`await page.${resolved}.press('Enter');`);
        result.setIncludeSnapshot();
      }
    });
  },
});

export const pressKey = defineTabTool({
  capability: 'core-input',
  schema: {
    name: 'browser_press_key',
    title: 'Press a key',
    description: 'Press a key on the keyboard',
    type: 'input',
  },
  handle: async (tab, params, result) => {
    result.addCode(`await page.keyboard.press('${params.key}');`);
    if (params.key === 'Enter') {
      result.setIncludeSnapshot();
      await tab.waitForCompletion(() => tab.page.keyboard.press('Enter'));
    } else {
      await tab.page.keyboard.press(params.key);
    }
  },
});

export default [type, pressKey];
