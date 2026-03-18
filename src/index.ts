/**
 * pi-browser extension
 *
 * Gives pi browser automation tools backed directly by Playwright.
 * Connect to your running Chromium-based browser via CDP, or launch a new one.
 *
 * Usage:
 *   /browser connect [port]   - attach to running browser (default port 9222)
 *   /browser launch           - launch a new Chromium instance
 *   /browser status           - show connection + open tabs
 *   /browser disconnect       - release the browser connection
 *
 * Once connected, the following tools become available:
 *   browser_navigate, browser_navigate_back, browser_reload
 *   browser_snapshot, browser_take_screenshot
 *   browser_click, browser_hover, browser_drag, browser_select_option
 *   browser_type, browser_press_key
 *   browser_fill_form
 *   browser_tabs
 *   browser_evaluate
 *   browser_wait_for
 *   browser_close, browser_resize
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { BrowserSession } from './browser-session';
import { BrowserToolResult } from './response';
import type { Context } from './context';
import type { Tool } from './tool';

import navigateTools from './tools/navigate';
import snapshotTools from './tools/snapshot';
import keyboardTools from './tools/keyboard';
import formTools from './tools/form';
import screenshotTools from './tools/screenshot';
import tabTools from './tools/tabs';
import evaluateTools from './tools/evaluate';
import waitTools from './tools/wait';
import commonTools from './tools/common';
import mouseTools from './tools/mouse';
import consoleTools from './tools/console';
import dialogTools from './tools/dialogs';
import fileTools from './tools/files';
import networkTools from './tools/network';
import routeTools from './tools/route';
import cookieTools from './tools/cookies';
import webstorageTools from './tools/webstorage';
import storageTools from './tools/storage';

// Helper type so params coming from pi can be cast safely
type Params = Record<string, any>;

function makeTool(session: BrowserSession, tool: Tool) {
  return async (params: Params) => {
    const context = session.context;
    if (!context)
      throw new Error('Browser not connected. Use /browser connect [port] or /browser launch first.');
    const result = new BrowserToolResult(context as Context);
    await tool.handle(context as Context, params, result);
    return result.build();
  };
}

export default function (pi: ExtensionAPI) {
  const session = new BrowserSession();

  // Collect all tool implementations indexed by name
  const toolMap = new Map<string, Tool>();
  for (const t of [
    ...navigateTools, ...snapshotTools, ...keyboardTools, ...formTools,
    ...screenshotTools, ...tabTools, ...evaluateTools, ...waitTools, ...commonTools,
    ...mouseTools, ...consoleTools, ...dialogTools, ...fileTools,
    ...networkTools, ...routeTools, ...cookieTools, ...webstorageTools, ...storageTools,
  ]) {
    toolMap.set(t.schema.name, t);
  }

  function run(name: string) {
    const tool = toolMap.get(name)!;
    return makeTool(session, tool);
  }

  // ---------- Navigation ----------

  pi.registerTool({
    name: 'browser_navigate',
    label: 'Navigate to URL',
    description: 'Navigate to a URL',
    parameters: Type.Object({ url: Type.String({ description: 'URL to navigate to' }) }),
    async execute(_id, params) {
      const r = await run('browser_navigate')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_navigate_back',
    label: 'Go back',
    description: 'Go back to the previous page in the history',
    parameters: Type.Object({}),
    async execute(_id, params) {
      const r = await run('browser_navigate_back')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_reload',
    label: 'Reload page',
    description: 'Reload the current page',
    parameters: Type.Object({}),
    async execute(_id, params) {
      const r = await run('browser_reload')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Observation ----------

  pi.registerTool({
    name: 'browser_snapshot',
    label: 'Page snapshot',
    description: 'Capture the accessibility tree of the current page to find element refs for interaction. Do NOT call after every action to confirm results — check the snapshot included in action responses instead. Use selector param to scope to a specific section if the page is large.',
    promptGuidelines: [
      'Call browser_snapshot only when you need to find an element ref to interact with, not to confirm results.',
      'Action tools (browser_click, browser_type, etc.) already include a snapshot in their response — do not call browser_snapshot again afterwards.',
      'If the snapshot is too large, re-call with a selector scoped to the relevant section of the page.',
    ],
    parameters: Type.Object({
      selector: Type.Optional(Type.String({ description: 'CSS selector for partial snapshot' })),
    }) as any,
    async execute(_id, params) {
      const r = await run('browser_snapshot')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_take_screenshot',
    label: 'Take screenshot',
    description: "Take a screenshot of the current page. Use browser_snapshot for interactions; use this to visually inspect.",
    parameters: Type.Object({
      type: Type.Optional(Type.String({ description: 'Image format: png or jpeg (default: png)' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector of element to screenshot' })),
      fullPage: Type.Optional(Type.Boolean({ description: 'Capture the full scrollable page' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_take_screenshot')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Interaction ----------

  pi.registerTool({
    name: 'browser_click',
    label: 'Click',
    description: 'Click an element on the page',
    parameters: Type.Object({
      ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      element: Type.Optional(Type.String({ description: 'Human-readable element description' })),
      doubleClick: Type.Optional(Type.Boolean({ description: 'Double-click instead of single click' })),
      button: Type.Optional(Type.String({ description: 'Mouse button: left, right, or middle' })),
      modifiers: Type.Optional(Type.Array(Type.String(), { description: 'Modifier keys: Alt, Control, Shift, Meta' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_click')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_hover',
    label: 'Hover',
    description: 'Hover over an element on the page',
    parameters: Type.Object({
      ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      element: Type.Optional(Type.String({ description: 'Human-readable element description' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_hover')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_select_option',
    label: 'Select option',
    description: 'Select an option in a dropdown',
    parameters: Type.Object({
      ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      element: Type.Optional(Type.String({ description: 'Human-readable element description' })),
      values: Type.Array(Type.String(), { description: 'Values to select' }),
    }),
    async execute(_id, params) {
      const r = await run('browser_select_option')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_drag',
    label: 'Drag',
    description: 'Drag and drop between two elements',
    parameters: Type.Object({
      startRef: Type.Optional(Type.String({ description: 'Source element reference' })),
      startSelector: Type.Optional(Type.String({ description: 'Source CSS selector' })),
      startElement: Type.Optional(Type.String({ description: 'Source element description' })),
      endRef: Type.Optional(Type.String({ description: 'Target element reference' })),
      endSelector: Type.Optional(Type.String({ description: 'Target CSS selector' })),
      endElement: Type.Optional(Type.String({ description: 'Target element description' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_drag')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Input ----------

  pi.registerTool({
    name: 'browser_type',
    label: 'Type text',
    description: 'Type text into an editable element',
    parameters: Type.Object({
      ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      element: Type.Optional(Type.String({ description: 'Human-readable element description' })),
      text: Type.String({ description: 'Text to type' }),
      submit: Type.Optional(Type.Boolean({ description: 'Press Enter after typing' })),
      slowly: Type.Optional(Type.Boolean({ description: 'Type one character at a time' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_type')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_press_key',
    label: 'Press key',
    description: 'Press a key on the keyboard',
    parameters: Type.Object({
      key: Type.String({ description: 'Key name such as ArrowLeft, Enter, or a character like a' }),
    }),
    async execute(_id, params) {
      const r = await run('browser_press_key')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_fill_form',
    label: 'Fill form',
    description: 'Fill multiple form fields at once',
    parameters: Type.Object({
      fields: Type.Array(Type.Object({
        name: Type.String({ description: 'Human-readable field name' }),
        type: Type.String({ description: 'textbox, checkbox, radio, combobox, or slider' }),
        ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
        selector: Type.Optional(Type.String({ description: 'CSS selector' })),
        value: Type.String({ description: 'Value to fill' }),
      }), { description: 'Fields to fill' }),
    }),
    async execute(_id, params) {
      const r = await run('browser_fill_form')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Tabs ----------

  pi.registerTool({
    name: 'browser_tabs',
    label: 'Manage tabs',
    description: 'List, create, close, or select browser tabs',
    parameters: Type.Object({
      action: Type.String({ description: 'list, new, close, or select' }),
      index: Type.Optional(Type.Number({ description: 'Tab index for close/select' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_tabs')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Scripting ----------

  pi.registerTool({
    name: 'browser_evaluate',
    label: 'Evaluate JavaScript',
    description: 'Evaluate a JavaScript expression on the current page',
    parameters: Type.Object({
      function: Type.String({ description: '() => expression or (element) => expression' }),
      ref: Type.Optional(Type.String({ description: 'Element reference from snapshot' })),
      selector: Type.Optional(Type.String({ description: 'CSS selector' })),
      element: Type.Optional(Type.String({ description: 'Human-readable element description' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_evaluate')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Waiting ----------

  pi.registerTool({
    name: 'browser_wait_for',
    label: 'Wait for',
    description: 'Wait for text to appear or disappear, or wait a specified number of seconds',
    parameters: Type.Object({
      time: Type.Optional(Type.Number({ description: 'Seconds to wait' })),
      text: Type.Optional(Type.String({ description: 'Text to wait to appear' })),
      textGone: Type.Optional(Type.String({ description: 'Text to wait to disappear' })),
    }),
    async execute(_id, params) {
      const r = await run('browser_wait_for')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Window ----------

  pi.registerTool({
    name: 'browser_close',
    label: 'Close page',
    description: 'Close the current browser page',
    parameters: Type.Object({}),
    async execute(_id, params) {
      const r = await run('browser_close')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  pi.registerTool({
    name: 'browser_resize',
    label: 'Resize window',
    description: 'Resize the browser window',
    parameters: Type.Object({
      width: Type.Number({ description: 'Width in pixels' }),
      height: Type.Number({ description: 'Height in pixels' }),
    }),
    async execute(_id, params) {
      const r = await run('browser_resize')(params as Params);
      return { content: r.content as any, details: r.details };
    },
  });

  // ---------- Mouse ----------

  pi.registerTool({
    name: 'browser_mouse_move_xy',
    label: 'Move mouse',
    description: 'Move mouse to an absolute x/y coordinate',
    parameters: Type.Object({
      x: Type.Number({ description: 'X coordinate' }),
      y: Type.Number({ description: 'Y coordinate' }),
    }),
    async execute(_id, params) { const r = await run('browser_mouse_move_xy')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_mouse_click_xy',
    label: 'Click at coordinates',
    description: 'Click at an absolute x/y coordinate. Prefer browser_click with a ref/selector when possible.',
    parameters: Type.Object({
      x: Type.Number({ description: 'X coordinate' }),
      y: Type.Number({ description: 'Y coordinate' }),
      button: Type.Optional(Type.String({ description: 'left, right, or middle' })),
      clickCount: Type.Optional(Type.Number({ description: 'Number of clicks' })),
      delay: Type.Optional(Type.Number({ description: 'Delay between mousedown and mouseup in ms' })),
    }),
    async execute(_id, params) { const r = await run('browser_mouse_click_xy')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_mouse_drag_xy',
    label: 'Drag between coordinates',
    description: 'Drag from one x/y coordinate to another',
    parameters: Type.Object({
      startX: Type.Number({ description: 'Start X' }),
      startY: Type.Number({ description: 'Start Y' }),
      endX: Type.Number({ description: 'End X' }),
      endY: Type.Number({ description: 'End Y' }),
    }),
    async execute(_id, params) { const r = await run('browser_mouse_drag_xy')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_mouse_down',
    label: 'Mouse button down',
    description: 'Press and hold a mouse button',
    parameters: Type.Object({ button: Type.Optional(Type.String({ description: 'left, right, or middle' })) }),
    async execute(_id, params) { const r = await run('browser_mouse_down')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_mouse_up',
    label: 'Mouse button up',
    description: 'Release a mouse button',
    parameters: Type.Object({ button: Type.Optional(Type.String({ description: 'left, right, or middle' })) }),
    async execute(_id, params) { const r = await run('browser_mouse_up')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_mouse_wheel',
    label: 'Scroll',
    description: 'Scroll the mouse wheel by deltaX/deltaY pixels',
    parameters: Type.Object({
      deltaX: Type.Optional(Type.Number({ description: 'Horizontal scroll amount' })),
      deltaY: Type.Optional(Type.Number({ description: 'Vertical scroll amount' })),
    }),
    async execute(_id, params) { const r = await run('browser_mouse_wheel')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Console ----------

  pi.registerTool({
    name: 'browser_console_messages',
    label: 'Console messages',
    description: 'Return console messages from the current page. Useful for debugging errors.',
    parameters: Type.Object({
      level: Type.Optional(Type.String({ description: 'Minimum level to return: error, warning, info, debug (default: info)' })),
    }),
    async execute(_id, params) { const r = await run('browser_console_messages')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_console_clear',
    label: 'Clear console',
    description: 'Clear recorded console messages',
    parameters: Type.Object({}),
    async execute(_id, params) { const r = await run('browser_console_clear')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Dialogs ----------

  pi.registerTool({
    name: 'browser_handle_dialog',
    label: 'Handle dialog',
    description: 'Accept or dismiss a browser dialog (alert, confirm, prompt)',
    parameters: Type.Object({
      accept: Type.Boolean({ description: 'true to accept, false to dismiss' }),
      promptText: Type.Optional(Type.String({ description: 'Text to enter for prompt dialogs' })),
    }),
    async execute(_id, params) { const r = await run('browser_handle_dialog')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Files ----------

  pi.registerTool({
    name: 'browser_file_upload',
    label: 'Upload files',
    description: 'Upload files via an open file chooser. Trigger a file input first, then call this.',
    parameters: Type.Object({
      paths: Type.Optional(Type.Array(Type.String(), { description: 'Absolute paths to files to upload' })),
    }),
    async execute(_id, params) { const r = await run('browser_file_upload')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Network ----------

  pi.registerTool({
    name: 'browser_network_requests',
    label: 'Network requests',
    description: 'List network requests made since last navigation. Useful for debugging API calls.',
    parameters: Type.Object({
      static: Type.Optional(Type.Boolean({ description: 'Include static resources (images, fonts, scripts). Default: false' })),
      requestBody: Type.Optional(Type.Boolean({ description: 'Include request body. Default: false' })),
      requestHeaders: Type.Optional(Type.Boolean({ description: 'Include request headers. Default: false' })),
      filter: Type.Optional(Type.String({ description: 'Regex to filter URLs (e.g. "/api/.*user")' })),
    }),
    async execute(_id, params) { const r = await run('browser_network_requests')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_network_clear',
    label: 'Clear network requests',
    description: 'Clear recorded network requests',
    parameters: Type.Object({}),
    async execute(_id, params) { const r = await run('browser_network_clear')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_network_state_set',
    label: 'Set network state',
    description: 'Set the browser to online or offline mode',
    parameters: Type.Object({ state: Type.String({ description: 'online or offline' }) }),
    async execute(_id, params) { const r = await run('browser_network_state_set')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Routes ----------

  pi.registerTool({
    name: 'browser_route',
    label: 'Mock network requests',
    description: 'Intercept and mock network requests matching a URL pattern',
    parameters: Type.Object({
      pattern: Type.String({ description: 'URL pattern to match (e.g. "**/api/users")' }),
      status: Type.Optional(Type.Number({ description: 'HTTP status code to return' })),
      body: Type.Optional(Type.String({ description: 'Response body' })),
      contentType: Type.Optional(Type.String({ description: 'Content-Type header' })),
      headers: Type.Optional(Type.Array(Type.String(), { description: 'Headers to add in "Name: Value" format' })),
      removeHeaders: Type.Optional(Type.String({ description: 'Comma-separated header names to remove' })),
    }),
    async execute(_id, params) { const r = await run('browser_route')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_route_list',
    label: 'List routes',
    description: 'List all active network route mocks',
    parameters: Type.Object({}),
    async execute(_id, params) { const r = await run('browser_route_list')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_unroute',
    label: 'Remove routes',
    description: 'Remove network route mocks matching a pattern, or all if no pattern given',
    parameters: Type.Object({ pattern: Type.Optional(Type.String({ description: 'URL pattern to remove' })) }),
    async execute(_id, params) { const r = await run('browser_unroute')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- Cookies ----------

  pi.registerTool({
    name: 'browser_cookie_list',
    label: 'List cookies',
    description: 'List all cookies, optionally filtered by domain or path',
    parameters: Type.Object({
      domain: Type.Optional(Type.String({ description: 'Filter by domain' })),
      path: Type.Optional(Type.String({ description: 'Filter by path' })),
    }),
    async execute(_id, params) { const r = await run('browser_cookie_list')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_cookie_get',
    label: 'Get cookie',
    description: 'Get a specific cookie by name',
    parameters: Type.Object({ name: Type.String({ description: 'Cookie name' }) }),
    async execute(_id, params) { const r = await run('browser_cookie_get')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_cookie_set',
    label: 'Set cookie',
    description: 'Set a cookie',
    parameters: Type.Object({
      name: Type.String({ description: 'Cookie name' }),
      value: Type.String({ description: 'Cookie value' }),
      domain: Type.Optional(Type.String({ description: 'Cookie domain (defaults to current page domain)' })),
      path: Type.Optional(Type.String({ description: 'Cookie path' })),
      expires: Type.Optional(Type.Number({ description: 'Expiry as Unix timestamp' })),
      httpOnly: Type.Optional(Type.Boolean()),
      secure: Type.Optional(Type.Boolean()),
      sameSite: Type.Optional(Type.String({ description: 'Strict, Lax, or None' })),
    }),
    async execute(_id, params) { const r = await run('browser_cookie_set')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_cookie_delete',
    label: 'Delete cookie',
    description: 'Delete a specific cookie by name',
    parameters: Type.Object({ name: Type.String({ description: 'Cookie name' }) }),
    async execute(_id, params) { const r = await run('browser_cookie_delete')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_cookie_clear',
    label: 'Clear cookies',
    description: 'Clear all cookies',
    parameters: Type.Object({}),
    async execute(_id, params) { const r = await run('browser_cookie_clear')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- localStorage ----------

  for (const [name, label, desc] of [
    ['browser_localstorage_list', 'List localStorage', 'List all localStorage key-value pairs'],
    ['browser_localstorage_clear', 'Clear localStorage', 'Clear all localStorage'],
    ['browser_sessionstorage_list', 'List sessionStorage', 'List all sessionStorage key-value pairs'],
    ['browser_sessionstorage_clear', 'Clear sessionStorage', 'Clear all sessionStorage'],
  ] as const) {
    pi.registerTool({
      name, label, description: desc,
      parameters: Type.Object({}),
      async execute(_id, params) { const r = await run(name)(params as Params); return { content: r.content as any, details: r.details }; },
    });
  }

  for (const [name, label, desc, store] of [
    ['browser_localstorage_get', 'Get localStorage item', 'Get a localStorage item by key', 'localStorage'],
    ['browser_localstorage_delete', 'Delete localStorage item', 'Delete a localStorage item', 'localStorage'],
    ['browser_sessionstorage_get', 'Get sessionStorage item', 'Get a sessionStorage item by key', 'sessionStorage'],
    ['browser_sessionstorage_delete', 'Delete sessionStorage item', 'Delete a sessionStorage item', 'sessionStorage'],
  ] as const) {
    pi.registerTool({
      name, label, description: desc,
      parameters: Type.Object({ key: Type.String({ description: `${store} key` }) }),
      async execute(_id, params) { const r = await run(name)(params as Params); return { content: r.content as any, details: r.details }; },
    });
  }

  for (const [name, label, desc, store] of [
    ['browser_localstorage_set', 'Set localStorage item', 'Set a localStorage item', 'localStorage'],
    ['browser_sessionstorage_set', 'Set sessionStorage item', 'Set a sessionStorage item', 'sessionStorage'],
  ] as const) {
    pi.registerTool({
      name, label, description: desc,
      parameters: Type.Object({
        key: Type.String({ description: `${store} key` }),
        value: Type.String({ description: 'Value to set' }),
      }),
      async execute(_id, params) { const r = await run(name)(params as Params); return { content: r.content as any, details: r.details }; },
    });
  }

  // ---------- Storage state ----------

  pi.registerTool({
    name: 'browser_storage_state',
    label: 'Save storage state',
    description: 'Save cookies and localStorage to a JSON file',
    parameters: Type.Object({ filename: Type.Optional(Type.String({ description: 'File path to save to' })) }),
    async execute(_id, params) { const r = await run('browser_storage_state')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  pi.registerTool({
    name: 'browser_set_storage_state',
    label: 'Restore storage state',
    description: 'Restore cookies and localStorage from a previously saved file',
    parameters: Type.Object({ filename: Type.String({ description: 'Path to storage state JSON file' }) }),
    async execute(_id, params) { const r = await run('browser_set_storage_state')(params as Params); return { content: r.content as any, details: r.details }; },
  });

  // ---------- /browser command ----------

  pi.registerCommand('browser', {
    description: 'Manage browser connection: connect [port], launch [browser], status, disconnect',
    handler: async (args, ctx) => {
      const parts = (args ?? '').trim().split(/\s+/).filter(Boolean);
      const sub = parts[0];

      if (!sub || sub === 'status') {
        const tabs = session.context?.tabs() ?? [];
        const tabLines = await Promise.all(
          tabs.map(async (t, i) => {
            const h = await t.headerSnapshot();
            return `  ${i}: ${h.current ? '* ' : '  '}[${h.title || 'blank'}] ${h.url}`;
          })
        );
        const msg = [`Browser: ${session.status()}`, ...(tabLines.length ? ['Tabs:', ...tabLines] : [])].join('\n');
        ctx.ui.notify(msg, 'info');
        return;
      }

      if (sub === 'connect') {
        const port = parseInt(parts[1] ?? '9222', 10);
        ctx.ui.notify(`Connecting to browser on port ${port}...`, 'info');
        try {
          await session.connect({ type: 'cdp', port }, { timeouts: { action: 10000, navigation: 30000 } });
          const tabCount = session.context?.tabs().length ?? 0;
          ctx.ui.notify(`Connected via CDP (port ${port}). ${tabCount} tab(s) found.`, 'info');
        } catch (e: any) {
          ctx.ui.notify(`Connection failed: ${e.message}`, 'error');
        }
        return;
      }

      if (sub === 'launch') {
        const browserName = (parts[1] ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
        ctx.ui.notify(`Launching ${browserName}...`, 'info');
        try {
          await session.connect({ type: 'launch', browserName }, { timeouts: { action: 10000, navigation: 30000 } });
          ctx.ui.notify(`Launched ${browserName}.`, 'info');
        } catch (e: any) {
          ctx.ui.notify(`Launch failed: ${e.message}`, 'error');
        }
        return;
      }

      if (sub === 'disconnect') {
        await session.disconnect();
        ctx.ui.notify('Browser disconnected.', 'info');
        return;
      }

      ctx.ui.notify(
        'Usage: /browser [connect [port] | launch [chromium|firefox|webkit] | status | disconnect]',
        'info'
      );
    },
  });

  // Clean up on session shutdown
  pi.on('session_shutdown', async () => {
    await session.disconnect();
  });
}
