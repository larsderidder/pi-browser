# pi-browser extension design

## Background

Lars wanted a way to share what he sees in the browser with pi, and to hand over browser control
for filling forms, clicking links, and navigating. This document captures the investigation into
the best approach and the resulting design.

## Approach chosen: direct Playwright in a pi extension

Three options were evaluated:

1. **Playwright MCP server** (separate process, pi bridges to it via a thin extension)
2. **Linux X11 screen capture** (xdotool + scrot, sees everything but brittle and hits X11 connection limits)
3. **Playwright directly in a pi extension** (Playwright as a Node.js library inside the extension process)

Option 3 was chosen because:

- pi explicitly has no MCP support by design (Mario's deliberate choice)
- Option 3 is the idiomatic pi approach: one process, direct API calls, no protocol overhead
- Playwright itself is the mature library; we wrap it in a pi extension instead of an MCP server
- Designed as a standalone package from the start, easy to open source later

## Source code investigation

The actual tool implementations live in the **Playwright monorepo**, not in the `playwright-mcp`
package. The `playwright-mcp` npm package is just a thin MCP server wrapper. The real source is at:

```
packages/playwright-core/src/tools/backend/
```

### Key classes (upstream)

**`Context`** (`context.ts`, ~383 lines)
- Owns the `BrowserContext`, manages `Tab` instances, routes, config
- `ensureTab()`, `newTab()`, `selectTab()`, `closeTab()`
- `ContextConfig` controls capabilities, timeouts, snapshot mode, codegen, etc.

**`Tab`** (`tab.ts`, ~567 lines)
- Wraps a single `playwright.Page`
- Tracks console messages, network requests, downloads, modal state (dialogs, file choosers)
- `captureSnapshot()` returns aria snapshot (incremental or full)
- `refLocator()` resolves element refs from snapshots to Playwright locators
- `waitForCompletion()` races action against modal state appearance

**`Response`** (`response.ts`, ~340 lines)
- Builder pattern: tools call `addTextResult()`, `addCode()`, `setIncludeSnapshot()`, `registerImageResult()`
- `serialize()` outputs MCP's `CallToolResult` (JSON-RPC shape with sections as markdown)
- Section types: Error, Result, Ran Playwright code, Open tabs, Page, Snapshot, Events, Modal state

**Tool definitions** (`tool.ts`)
- `Tool<Input>` and `TabTool<Input>` types with `handle(context/tab, params, response)`
- `defineTool()` and `defineTabTool()` convenience wrappers
- Uses zod for input schemas

### Tool inventory

All tools in `backend/tools.ts` grouped by capability:

| Capability | Tools | Source file |
|-----------|-------|-------------|
| `core` | `browser_close`, `browser_resize` | `common.ts` |
| `core-navigation` | `browser_navigate`, `browser_navigate_back`, `browser_reload` | `navigate.ts` |
| `core` | `browser_snapshot`, `browser_click`, `browser_drag`, `browser_hover`, `browser_select_option` | `snapshot.ts` |
| `core` | `browser_fill_form` | `form.ts` |
| `core-input` | `browser_type`, `browser_press_key` | `keyboard.ts` |
| `core` | `browser_take_screenshot` | `screenshot.ts` |
| `core-tabs` | `browser_tabs` (list/new/close/select) | `tabs.ts` |
| `core` | `browser_evaluate` | `evaluate.ts` |
| `core` | `browser_wait_for` | `wait.ts` |
| `core-input` | `browser_press_key`, `browser_type` | `keyboard.ts` |
| `vision` | screenshot variants | `screenshot.ts` |
| `network` | request inspection, mocking | `network.ts`, `route.ts` |
| `storage` | cookies, webstorage | `cookies.ts`, `webstorage.ts`, `storage.ts` |
| `pdf` | PDF output | `pdf.ts` |
| `testing` | locator generation, assertions | `verify.ts`, `runCode.ts` |
| `devtools` | DevTools protocol | `devtools.ts` |

### Browser connection modes (from `browserFactory.ts`)

```
1. CDP attach    -- connectOverCDP to a running browser (--remote-debugging-port=9222)
2. Persistent    -- launchPersistentContext with user profile dir
3. Isolated      -- launch fresh headless browser
4. Extension     -- Chrome extension relay via CDPRelayServer (complex, not needed)
5. Remote        -- Playwright server endpoint
```

## What we lift vs adapt vs drop

### Lift almost verbatim (only schema syntax changes: zod → TypeBox)

- `navigate.ts` - browser_navigate, browser_navigate_back, browser_reload
- `snapshot.ts` - browser_snapshot, browser_click, browser_drag, browser_hover, browser_select_option
- `form.ts` - browser_fill_form
- `keyboard.ts` - browser_type, browser_press_key, browser_press_sequentially
- `tabs.ts` - browser_tabs
- `evaluate.ts` - browser_evaluate
- `wait.ts` - browser_wait_for
- `common.ts` - browser_close, browser_resize

The `handle()` function bodies are unchanged. Only the TypeBox schema declaration and the
`tool.ts` type wrapper differ.

### Adapt

- `context.ts` - Drop MCP-specific `SessionLog`, `outputDir` file plumbing, simplify `ContextConfig`
- `tab.ts` - Keep almost entirely. Drop `LogFile` (write console to file).
- `response.ts` - **Replace entirely.** MCP returns `CallToolResult`. pi tools return
  `{ content: [...], details: {} }`. The `_build()` section-building logic is reused, but
  `serialize()` is replaced with `toPiResult()` that outputs sections as markdown text
  and images as pi image blocks.
- `screenshot.ts` - Instead of saving to file and returning a link, return base64 image content
  directly to pi so it renders inline in the TUI.

### Drop for v1

- `mouse.ts` - Raw coordinate mouse actions (scroll, move). Useful but not essential.
- `network.ts` / `route.ts` - Request inspection and mocking. Dev use, not browsing.
- `cookies.ts` / `webstorage.ts` / `storage.ts` - Session export/import. Defer.
- `pdf.ts` / `video.ts` / `tracing.ts` - Out of scope.
- `console.ts` - Console log tool. Info available from snapshot response.
- `devtools.ts` / `verify.ts` / `runCode.ts` - Testing workflow, not browsing.
- `files.ts` / `dialogs.ts` - File uploads and dialog handling. Defer.

## File structure

```
~/.pi/agent/extensions/browser/
├── package.json              npm package: declares playwright dep, pi entry point
├── DESIGN.md                 this file
├── index.ts                  pi extension entry: registers tools + /browser command
├── browser-session.ts        manages Browser + Context lifecycle, CDP connect/disconnect
├── context.ts                adapted from pw-mcp Context class
├── tab.ts                    adapted from pw-mcp Tab class
├── response.ts               new: builds pi-compatible tool results from section data
├── tool.ts                   internal Tool/TabTool type defs (no MCP dependency)
└── tools/
    ├── navigate.ts
    ├── snapshot.ts
    ├── form.ts
    ├── keyboard.ts
    ├── screenshot.ts
    ├── tabs.ts
    ├── evaluate.ts
    ├── wait.ts
    └── common.ts
```

## Key design decision: Response → pi tool result

The upstream `Response.serialize()` produces:

```json
{
  "content": [{ "type": "text", "text": "### Result\n...\n### Snapshot\n```yaml\n..." }],
  "isError": false
}
```

In pi, a tool returns:

```typescript
{
  content: [{ type: "text", text: "..." }],  // sent to LLM
  details: { snapshot: "...", tabs: [...] }   // for rendering
}
```

The section-building logic from `_build()` is reused to produce the markdown text block.
Images go into additional `content` entries as `{ type: "image", source: { type: "base64", ... } }`.
Structured data (snapshot text, tab list) goes into `details` for potential custom TUI rendering.

## `/browser` command

```
/browser connect [port=9222]   attach to running Chromium via CDP
/browser launch                launch and manage Playwright's own Chromium
/browser status                show connection status + open tabs
/browser disconnect            release browser connection
```

After `connect`, all `browser_*` tools become active. Before connect they return a clear error.

## Browser compatibility

- CDP attach works with Chromium-family only (Chrome, Brave, Chromium, Edge, Opera)
- Launch mode can use Firefox or WebKit too (Playwright manages its own browser)
- For Lars's use case: launch target browser with `--remote-debugging-port=9222` once,
  or add it to a browser launcher alias

## Open-source packaging

The design keeps pi-specific code isolated to `index.ts` and `browser-session.ts`.
All tool files depend only on `Context`, `Tab`, `Response` (internal) and `playwright` (npm).

To open source:
1. Move to a standalone repo
2. Publish as `pi-browser` on npm
3. Users install via pi's package mechanism (`settings.json` packages array)

## Sizing

| Component | Lines |
|-----------|-------|
| `browser-session.ts` + `index.ts` | ~150 |
| `context.ts` + `tab.ts` adaptation | ~600 (most lifted) |
| `response.ts` replacement | ~100 |
| TypeBox schema conversions across tools | ~200 mechanical |
| Tool `handle` bodies (lifted verbatim) | ~0 extra effort |
| `package.json` + wiring | trivial |

Total: ~1000 lines, majority adapted from upstream Playwright.
