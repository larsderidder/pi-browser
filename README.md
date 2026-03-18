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

Configure your browser to always start with remote debugging enabled so pi can attach.

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

If you run both at the same time, the second one won't bind its port and will launch normally without CDP. Use different ports to avoid this.

## Usage

```
/browser connect        # attach to Chromium on port 9222
/browser connect 9223   # attach to Brave
/browser launch         # launch a new Chromium instance
/browser status         # show connection and open tabs
/browser disconnect
```

Once connected, the browser tools are available for the rest of the session.

## Tools

**Navigation**
- `browser_navigate`, `browser_navigate_back`, `browser_reload`

**Observation**
- `browser_snapshot` — accessibility tree, gives element refs for interaction
- `browser_take_screenshot`

**Interaction**
- `browser_click`, `browser_hover`, `browser_drag`
- `browser_type`, `browser_press_key`, `browser_fill_form`
- `browser_select_option`

**Tabs**
- `browser_tabs` — list, create, close, or select; shows tabs across all windows

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
- `browser_evaluate` — run JavaScript on the page
- `browser_wait_for`
- `browser_close`, `browser_resize`
- `browser_file_upload`

## Notes

- Only Chromium-based browsers support CDP attach (Chrome, Chromium, Brave, Edge, Opera). Firefox doesn't.
- Tabs in separate browser windows show up in `browser_tabs` with a warning. Selecting one navigates your current tab to that URL instead of controlling the original window directly; that's a Playwright CDP limitation.
- Browser extensions (Bitwarden etc.) run in an isolated context that CDP can't reach.

## License

MIT
