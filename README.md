# pi-browser

A pi extension that gives the agent a real browser, backed by Playwright.

Connect to your running Chromium-based browser via CDP, or let the extension launch one; once connected, you get 50+ tools covering navigation, clicking, typing, form filling, screenshots, tab management, cookie manipulation, network interception, localStorage, console messages, dialogs, and file upload.

The main thing that makes this different from other pi browser tools is that it attaches to a browser that's already open. You're looking at a page, you tell pi to interact with it, and it does, without a separate browser window or starting fresh.

## Install

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/larsderidder/pi-browser
cd pi-browser
npm install
```

Pi picks up the extension on next launch.

## Browser setup

Any Chromium-based browser works: Chrome, Chromium, Brave, Edge, Opera, Arc, Vivaldi. You need to launch it with `--remote-debugging-port=<port>` so pi can attach. The port number is up to you; 9222 is conventional.

The cleanest way is to override the `.desktop` launcher so every launch includes the flag automatically.

### Chromium

Create `~/.local/share/applications/chromium-browser.desktop`:

```ini
[Desktop Entry]
Version=1.0
Name=Chromium
Exec=/usr/bin/chromium-browser --remote-debugging-port=9222 %U
Terminal=false
Type=Application
```

### Brave

Create `~/.local/share/applications/brave-browser.desktop`:

```ini
[Desktop Entry]
Version=1.0
Name=Brave Web Browser
Exec=/usr/bin/brave-browser-stable --remote-debugging-port=9223 %U
Terminal=false
Type=Application
```

For other browsers, find the system `.desktop` file (usually in `/usr/share/applications/`), copy it to `~/.local/share/applications/`, and add `--remote-debugging-port=<port>` to the `Exec` line. The local copy takes precedence.

On macOS and Windows, pass the flag via an alias or shortcut instead. On macOS: `alias chrome='open -a "Google Chrome" --args --remote-debugging-port=9222'`.

If you run multiple browsers at the same time, give each a different port. Two browsers can't share a port; the second one to start just launches normally without CDP.

## Usage

```
/browser connect        # attach to browser on port 9222 (default)
/browser connect 9223   # attach on a specific port
/browser launch         # launch a new Chromium instance
/browser status         # show connection and open tabs
/browser disconnect
```

Once connected, the browser tools are available for the rest of the session.

## Tools

### Navigation

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_navigate_back` | Go back in history |
| `browser_reload` | Reload the current page |

### Observation

| Tool | Description |
|------|-------------|
| `browser_snapshot` | Capture the accessibility tree; returns element refs for interaction |
| `browser_take_screenshot` | Take a screenshot of the page or a specific element |

### Interaction

| Tool | Description |
|------|-------------|
| `browser_click` | Click an element (by ref, selector, or description) |
| `browser_hover` | Hover over an element |
| `browser_drag` | Drag from one element to another |
| `browser_type` | Type text into a field |
| `browser_press_key` | Press a keyboard key |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select a dropdown option |

### Tabs

| Tool | Description |
|------|-------------|
| `browser_tabs` | List, create, close, or select tabs; shows tabs across all open windows |

### Mouse

| Tool | Description |
|------|-------------|
| `browser_mouse_move_xy` | Move mouse to absolute coordinates |
| `browser_mouse_click_xy` | Click at absolute coordinates |
| `browser_mouse_drag_xy` | Drag between two coordinates |
| `browser_mouse_down` | Press and hold a mouse button |
| `browser_mouse_up` | Release a mouse button |
| `browser_mouse_wheel` | Scroll by delta |

### Console & Dialogs

| Tool | Description |
|------|-------------|
| `browser_console_messages` | Return recorded console messages |
| `browser_console_clear` | Clear the console message buffer |
| `browser_handle_dialog` | Accept or dismiss an alert/confirm/prompt dialog |

### Network

| Tool | Description |
|------|-------------|
| `browser_network_requests` | List requests made since last navigation |
| `browser_network_clear` | Clear the request buffer |
| `browser_network_state_set` | Switch the browser to online or offline mode |
| `browser_route` | Intercept requests matching a URL pattern and return a mock response |
| `browser_route_list` | List active route mocks |
| `browser_unroute` | Remove route mocks |

### Storage

| Tool | Description |
|------|-------------|
| `browser_cookie_list` | List cookies, optionally filtered by domain or path |
| `browser_cookie_get` | Get a cookie by name |
| `browser_cookie_set` | Set a cookie |
| `browser_cookie_delete` | Delete a cookie by name |
| `browser_cookie_clear` | Clear all cookies |
| `browser_localstorage_list` | List all localStorage entries |
| `browser_localstorage_get` | Get a localStorage item |
| `browser_localstorage_set` | Set a localStorage item |
| `browser_localstorage_delete` | Delete a localStorage item |
| `browser_localstorage_clear` | Clear all localStorage |
| `browser_sessionstorage_list` | List all sessionStorage entries |
| `browser_sessionstorage_get` | Get a sessionStorage item |
| `browser_sessionstorage_set` | Set a sessionStorage item |
| `browser_sessionstorage_delete` | Delete a sessionStorage item |
| `browser_sessionstorage_clear` | Clear all sessionStorage |
| `browser_storage_state` | Save cookies and localStorage to a file |
| `browser_set_storage_state` | Restore cookies and localStorage from a file |

### Other

| Tool | Description |
|------|-------------|
| `browser_evaluate` | Run a JavaScript expression on the page or a specific element |
| `browser_wait_for` | Wait for text to appear/disappear, or wait a number of seconds |
| `browser_resize` | Resize the browser window |
| `browser_close` | Close the current tab |
| `browser_file_upload` | Upload files via an open file chooser |

## Notes

- Only Chromium-based browsers support CDP attach. Firefox doesn't expose the CDP protocol.
- Tabs in separate browser windows show up in `browser_tabs` with a warning. Selecting one navigates your current tab to that URL rather than controlling the original window directly; that's a Playwright CDP limitation.
- Browser extensions (Bitwarden etc.) run in an isolated context that CDP can't reach.

## License

MIT
