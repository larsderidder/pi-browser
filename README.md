# pi-browser

Browser automation tools for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent), backed by Playwright.

Connect pi to your running Chromium-based browser via CDP, or let it launch one. Gives you 50+ tools to navigate, click, type, screenshot, inspect the DOM, manage cookies, intercept network requests, and more — all from within a pi session.

## Installation

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/larsderidder/pi-browser
cd pi-browser
npm install
```

Pi will pick up the extension automatically on next launch.

## Browser setup

For the best experience, configure your browser to always start with remote debugging enabled.

### Chromium (port 9222)

Create `~/.local/share/applications/chromium-browser.desktop`:

```ini
[Desktop Entry]
Version=1.0
Name=Chromium
Exec=/usr/bin/chromium-browser --remote-debugging-port=9222 %U
Terminal=false
Type=Application
```

### Brave (port 9223)

Create `~/.local/share/applications/brave-browser.desktop`:

```ini
[Desktop Entry]
Version=1.0
Name=Brave Web Browser
Exec=/usr/bin/brave-browser-stable --remote-debugging-port=9223 %U
Terminal=false
Type=Application
```

## Usage

Once connected, browser tools are available in any pi session.

### Commands

| Command | Description |
|---------|-------------|
| `/browser connect [port]` | Attach to a running browser (default: 9222) |
| `/browser launch [chromium\|firefox\|webkit]` | Launch a new browser |
| `/browser status` | Show connection status and open tabs |
| `/browser disconnect` | Release the connection |

### Tools

**Navigation**
- `browser_navigate` — Navigate to a URL
- `browser_navigate_back` — Go back in history
- `browser_reload` — Reload the current page

**Observation**
- `browser_snapshot` — Capture the accessibility tree (use this to find element refs)
- `browser_take_screenshot` — Take a screenshot

**Interaction**
- `browser_click`, `browser_hover`, `browser_drag`
- `browser_type`, `browser_press_key`, `browser_fill_form`
- `browser_select_option`

**Tabs**
- `browser_tabs` — List, create, close, or select tabs

**Mouse**
- `browser_mouse_move_xy`, `browser_mouse_click_xy`, `browser_mouse_drag_xy`
- `browser_mouse_down`, `browser_mouse_up`, `browser_mouse_wheel`

**Console & Dialogs**
- `browser_console_messages`, `browser_console_clear`
- `browser_handle_dialog`

**Network**
- `browser_network_requests`, `browser_network_clear`, `browser_network_state_set`
- `browser_route`, `browser_route_list`, `browser_unroute`

**Storage**
- `browser_cookie_list/get/set/delete/clear`
- `browser_localstorage_list/get/set/delete/clear`
- `browser_sessionstorage_list/get/set/delete/clear`
- `browser_storage_state`, `browser_set_storage_state`

**Other**
- `browser_evaluate` — Run JavaScript on the page
- `browser_wait_for` — Wait for text or a timeout
- `browser_close`, `browser_resize`
- `browser_file_upload`

## Notes

- Only Chromium-based browsers are supported for CDP attach (Chrome, Chromium, Brave, Edge, Opera).
- If you run both Chromium and Brave simultaneously, use different ports (9222 and 9223).
- Tabs in separate browser windows are shown in `browser_tabs` but marked as "different window". Selecting one navigates your current tab to that URL.
- Browser extensions (e.g. Bitwarden) run in an isolated context and cannot be interacted with via CDP.

## License

MIT
