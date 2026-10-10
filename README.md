# Absolute Note

A Chrome and Firefox extension for creating **persistent sticky notes** on any web page. Notes keep their position when scrolling, after page reloads, and when navigating between routes in SPAs.

## Quick start

```
Click the extension icon → "Add Note" → a note appears on the page
Click the extension icon → "Recovery" → export/import all notes as JSON
```

---

## Features

- Notes positioned inside the page's **scroll container** (scroll naturally with content)
- **4 Material Design colors** selectable per note
- **Drag** from the header without interfering with page scroll
- **Rich text editing** inside the note: bold, italic, underline and font size
- **Voice dictation**: a 🎤 button in the editing toolbar turns speech into text at the caret, and you keep typing as usual (Chrome only; hidden where the browser has no speech recognition, e.g. Firefox)
- **Word count**: every note shows its number of words in a footer that is always visible and updates as you type
- **Lock/unlock** individual notes from the outline (disables editing and dragging)
- **Per-page persistence** in `chrome.storage.local`; in-page anchors (`#section`) and tracking parameters (`utm_*`, `fbclid`, …) don't change the page a note belongs to
- **Live sync**: tabs showing the same page, the outline window and imports update each other
- **Light/dark theme**: a button in the popup switches the extension's UI (popup, Recovery, outline panel and window) between themes; it follows the browser's color scheme until you pick one
- **Customizable defaults**: set width, height and font size for new notes from the popup
- **Resizable**: drag the bottom-right corner to change width and height; size and position persist across reloads
- **SPA support** (React, etc.): detects URL changes and reloads notes automatically
- **Outline panel**: side panel listing all notes sorted by position, with navigation and deletion
- **Detachable outline**: eject the outline panel into its own window; it follows the tab it was last opened from
- **Export and import** all notes as JSON from the dedicated **Recovery** page
- **Sanitized HTML**: note content is filtered on render, save and import to prevent XSS

---

## Installation

The extension is built from `src/` into `dist/chrome` and `dist/firefox`. With Node.js 20+:

```
npm install
npm run build
```

**Chrome**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select `dist/chrome`

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `dist/firefox/manifest.json`

---

## Development

| Command | What it does |
|---|---|
| `npm run build` | Bundles `src/` with esbuild into `dist/chrome` and `dist/firefox` |
| `npm run watch` | Rebuilds the scripts on change (static files are copied once) |
| `npm test` | Unit tests (Vitest + jsdom) |
| `npm run lint` | ESLint, then build and `web-ext lint` on the Firefox build |
| `npm run start:firefox` / `npm run start:chrome` | Launches a browser with the extension loaded (`web-ext run`) |
| `npm run package` | Zips both builds into `dist/packages` |

### Project layout

| Path | Purpose |
|---|---|
| `manifest.base.json` | Manifest shared by both browsers |
| `manifest.chrome.json` / `manifest.firefox.json` | Per-browser keys (background service worker vs. background scripts, Gecko id) |
| `scripts/build.mjs` | Build: bundles each entry point and writes the merged manifest (version from `package.json`) |
| `src/shared/` | Code used by every context: storage layer (`store.js`), note schema, URL normalization, sanitizer, i18n, message contract, backup/import and storage migrations |
| `src/content/` | Content script: `index.js` wires the page (navigation, outline panel, hide/show, messages), `controller.js` owns the page's notes and every write, `note-view.js` / `inline-editor.js` / `outline-panel.js` are the views, `container.js` handles scroll containers and coordinates. `styles.css` hardens the note element and its body against page CSS; the controls, toolbar and outline panel render in shadow roots styled by `css/*.css` |
| `src/background/` | Opens and retargets the detached outline window; runs storage migrations on install/update |
| `src/ui/` | Popup, Recovery page, detached outline window, and the outline list shared with the in-page panel |
| `test/` | Unit tests |

### How the pieces talk

- Only `NotesController` (content script) changes a page's notes. Views report user intent to it.
- All storage access goes through `src/shared/store.js`. Writes to a page's notes run one at a time and only change the fields that changed, so concurrent writes don't overwrite each other and deleted notes aren't recreated.
- Every context listens to `storage.onChanged`, so tabs, the outline window and the Recovery page don't need to message each other to stay in sync.
- Messages have named types (`src/shared/messages.js`); popup and outline window commands go to the tab's top frame.
- Page CSS can't restyle the extension: notes sit above page content (`z-index`), their controls and the outline panel live in shadow roots, and modals or cookie banners are never used as a note's scroll container.

---

## Usage

### Create a note

- Click the extension icon → **"Add Note"** (or use **Create note** in the outline panel)
- The note appears in the center of the viewport, ready for typing

### Edit

- **Double-click** a note to edit it; a toolbar appears below it
- The toolbar offers **bold**, *italic*, underline and font size
- Click **✓** or anywhere outside the note to save
- `Ctrl/Cmd+B`, `I`, `U` work as shortcuts
- **Dictate**: click 🎤 to start (it turns red while listening) and click it again to stop. Text is inserted at the caret in the extension's language (English or Spanish). The first time on a site the browser asks for microphone permission, which needs an HTTPS page; audio is processed by the browser's own speech service

### Drag

- Drag from the note **header** (with the mouse, anywhere on the note while not editing)
- Page scroll is disabled while dragging

### Colors

- Click the color circles in the header to change the note color

### Lock

- Click the lock icon 🔓 next to the note in the outline (in-page or detached)
- Locked: cannot be edited or dragged, only text selection

### Delete

- Click the **×** in the note header, or the **×** in the outline

### Resize

- Drag the bottom-right corner to adjust the **width and height**
- The height works as a minimum: notes still **auto-grow vertically** to fit their text, so they can't be shrunk below it
- The new size is saved

### Customize new notes

- Extension icon → **"Customize notes"**
- Set the **width**, **height** and **font size** used by new notes
- Existing notes keep their own values

### Outline panel

- Click the extension icon → **"View Outline"**
- Lists all notes sorted by vertical position
- Click an item to scroll to the note; ✏️ edits it, 🔒 locks it, **×** deletes it
- Click the **⧉** button to detach the outline into its own window; from there you can still add, edit, delete, lock and jump to notes (the in-page panel hides while detached). Detaching from another tab switches the window to that tab

### Export / Import

- From the extension popup, click **"Recovery"** to open the recovery page:
  - **Export**: downloads a JSON file with all notes from all pages
  - **Import**: loads a JSON file and merges notes (without duplicating existing IDs); open tabs show imported notes right away
- Exports from earlier versions can be imported
- Note content is sanitized on import

---

## Data structure

Each note is stored with this structure:

```json
{
  "id": "lorem123",
  "text": "<p>Note <b>content</b></p>",
  "locked": false,
  "colorIndex": 0,
  "anchor": "top",
  "posX_px": 350,
  "posY_px": 1200,
  "w_px": 170,
  "h_px": 325,
  "fontSize": 14
}
```

- `text` holds **sanitized HTML** (legacy plain-text notes are handled automatically)
- `posX_px` is the note's horizontal center and `posY_px` its top edge, relative to the page's scroll container
- `w_px`/`h_px`/`fontSize` are optional; `h_px` is the minimum height set from preferences or the resize grip (notes grow with their text)

Notes are stored in `chrome.storage.local` with one key per page. The page URL is normalized: in-page anchors and tracking parameters are removed, while hash routes such as `#/inbox` are kept.

```
absolute_note_https://example.com/page → [note1, note2, ...]
```

Other keys:

| Key | Value |
|---|---|
| `absolute_note_settings` | New-note preferences: `{ "width": 170, "height": 325, "fontSize": 14 }` |
| `absolute_note_lang` | UI language (`en` / `es`) |
| `absolute_note_theme` | `"light"` or `"dark"`; absent until chosen (then the browser's color scheme is used) |
| `absolute_note_outline_<url>` | `"visible"` while the outline panel is open on that page (removed when closed) |
| `absolute_note_hide_<url>` | `"hidden"` while notes are hidden on that page (removed when shown) |
| `absolute_note_schema` | Storage schema version; older data is migrated on install/update |

---

## Compatibility

- **Chrome** 102+ / **Firefox** 121+ (Manifest V3)
- Works on static pages and **SPAs** (React, Vue, Angular, etc.) and inside **iframes** (`all_frames`)
- Supports `pushState`, `replaceState`, `popstate`, and `hashchange` navigation

---

## License

GNU General Public License v3. See `LICENSE`.
