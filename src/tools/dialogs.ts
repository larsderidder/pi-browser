import { defineTabTool } from '../tool';

export const handleDialog = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_handle_dialog',
    title: 'Handle dialog',
    description: 'Accept or dismiss a browser dialog (alert, confirm, prompt). Call this when a dialog is blocking interaction.',
    type: 'action',
  },
  handle: async (tab, params, result) => {
    const state = tab.modalStates().find(s => s.type === 'dialog');
    if (!state || state.type !== 'dialog')
      throw new Error('No dialog visible');

    tab.clearModalState(state);
    await tab.waitForCompletion(async () => {
      if (params.accept)
        await state.dialog.accept(params.promptText);
      else
        await state.dialog.dismiss();
    });

    result.addTextResult(`Dialog ${params.accept ? 'accepted' : 'dismissed'}.`);
    result.addCode(`await dialog.${params.accept ? `accept(${params.promptText ? JSON.stringify(params.promptText) : ''})` : 'dismiss()'};`);
    result.setIncludeSnapshot();
  },
});

export default [handleDialog];
