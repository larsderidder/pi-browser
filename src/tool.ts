/**
 * Internal Tool type definitions for pi-browser.
 * Mirrors the structure from playwright-core/src/tools/backend/tool.ts
 * but without any MCP or zod dependency.
 */

import type { Context } from './context';
import type { Tab } from './tab';
import type { BrowserToolResult } from './response';

export type ToolType = 'input' | 'assertion' | 'action' | 'readOnly';

export type ToolSchema = {
  name: string;
  title: string;
  description: string;
  type: ToolType;
};

export type Tool = {
  capability: string;
  schema: ToolSchema;
  handle: (context: Context, params: Record<string, any>, result: BrowserToolResult) => Promise<void>;
};

export type TabTool = {
  capability: string;
  schema: ToolSchema;
  handle: (tab: Tab, params: Record<string, any>, result: BrowserToolResult) => Promise<void>;
};

export function defineTool(tool: Tool): Tool {
  return tool;
}

export function defineTabTool(tool: TabTool): Tool {
  return {
    capability: tool.capability,
    schema: tool.schema,
    handle: async (context: Context, params: Record<string, any>, result: BrowserToolResult) => {
      const tab = await context.ensureTab();
      return tool.handle(tab, params, result);
    },
  };
}
