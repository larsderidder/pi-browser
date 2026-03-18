import { defineTabTool } from '../tool';

export const fillForm = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_fill_form',
    title: 'Fill form',
    description: `Fill multiple form fields at once.

**Fallback for reactive frameworks (Vue, React, etc.):** If fields appear filled but the
framework state does not update (form stays invalid, values not submitted), use
\`browser_evaluate\` to set each field via \`document.execCommand\`:

\`\`\`js
() => {
  const inputs = document.querySelectorAll('input.your-class');
  inputs[0].focus();
  document.execCommand('insertText', false, 'field value');
  return inputs[0].value;
}
\`\`\`

This fires the native input event that reactive frameworks (Vue, React) listen to,
whereas \`locator.fill()\` sets the DOM value directly and may bypass reactivity.`,
    type: 'input',
  },
  handle: async (tab, params, result) => {
    for (const field of params.fields as Array<{ name: string; type: string; ref?: string; selector?: string; value: string }>) {
      const { locator, resolved } = await tab.refLocator({ element: field.name, ref: field.ref, selector: field.selector });
      const src = `await page.${resolved}`;
      if (field.type === 'textbox' || field.type === 'slider') {
        await locator.fill(field.value, tab.actionTimeoutOptions);
        result.addCode(`${src}.fill(${JSON.stringify(field.value)});`);
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        await locator.setChecked(field.value === 'true', tab.actionTimeoutOptions);
        result.addCode(`${src}.setChecked(${field.value});`);
      } else if (field.type === 'combobox') {
        await locator.selectOption({ label: field.value }, tab.actionTimeoutOptions);
        result.addCode(`${src}.selectOption(${JSON.stringify(field.value)});`);
      }
    }
    result.setIncludeSnapshot();
  },
});

export default [fillForm];
