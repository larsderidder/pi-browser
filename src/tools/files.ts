import { defineTabTool } from '../tool';

export const fileUpload = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_file_upload',
    title: 'Upload files',
    description: 'Upload one or more files via an open file chooser dialog. Call after a file input is triggered.',
    type: 'action',
  },
  handle: async (tab, params, result) => {
    const state = tab.modalStates().find(s => s.type === 'fileChooser');
    if (!state || state.type !== 'fileChooser')
      throw new Error('No file chooser visible. Trigger a file input first.');

    tab.clearModalState(state);
    await tab.waitForCompletion(async () => {
      if (params.paths?.length)
        await state.fileChooser.setFiles(params.paths);
    });

    result.addTextResult(params.paths?.length ? `Uploaded: ${params.paths.join(', ')}` : 'File chooser cancelled.');
    result.addCode(`await fileChooser.setFiles(${JSON.stringify(params.paths ?? [])});`);
    result.setIncludeSnapshot();
  },
});

export default [fileUpload];
