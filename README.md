# Absolute Note

A Chrome extension for creating **persistent sticky notes** on any web page. Notes keep their position when scrolling, after page reloads, and when navigating between routes in SPAs.

## Quick start

```
Right-click → "Absolute Note: Add Note" → a note appears at the click position
Click the extension icon → popup with Outline / Export / Import
```

---

## Features

- Notes positioned inside the page's **scroll container** (scroll naturally with content)
- **4 Material Design colors** selectable per note
- **Drag** from the header without interfering with page scroll
- **Rich text editor**: the ✏️ button opens a modal with bold, italic, underline and font size; notes render the rich content inline
- **Lock/unlock** individual notes (disables editing and dragging)
- **Per-URL persistence**: each page saves its own notes in `chrome.storage.local`
- **Customizable defaults**: set width, height and font size for new notes from the popup
- **Resizable**: drag the bottom-right corner; size and position persist across reloads
- **SPA support** (React, etc.): detects URL changes and reloads notes automatically
- **Outline panel**: side panel listing all notes sorted by position, with navigation and deletion
- **Export and import** all notes as JSON (works from the popup on any page)
- **Sanitized HTML**: note content is filtered on render, save and import to prevent XSS

---

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the project folder

---

## Project files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest with permissions, content script, and popup |
| `background.js` | Service worker: creates the "Add Note" context menu item and syncs language across tabs |
| `sanitize.js` | HTML sanitizer (allowlist) used by render, save, and import |
| `content.js` | Core logic: notes, drag, rich text modal, outline, SPA detection |
| `styles.css` | Styles for notes, colors, outline, modal, and buttons |
| `popup.html` | Popup window with outline, export/import, language, and note preferences |
| `popup.js` | Handles popup actions, export/import from storage, and note preferences |
| `icon.png` | Extension icon |

---

## Usage

### Create a note

- **Right-click** anywhere on the page → **"Absolute Note: Add Note"**
- The note appears at the click position, ready for typing

### Edit

- Click the ✏️ button in the header to open the rich text editor
- The modal offers **bold**, *italic*, underline, and font size
- Click **Save** to apply, **Cancel** or press `Esc` to discard
- Press `Enter` for a new line; `Ctrl/Cmd+B`, `I`, `U` work as shortcuts

### Drag

- Drag from the note **header**
- Page scroll is disabled while dragging

### Colors

- Click the color circles in the header to change the note color

### Lock

- Click the lock icon 🔒 to lock/unlock the note
- Locked: cannot be edited or dragged, only text selection

### Delete

- Click the **×** in the note header, or the **×** in the outline panel

### Resize

- Drag the bottom-right corner of the note body
- The new size and position are saved

### Customize new notes

- Extension icon → **"Customize notes"**
- Set the **width**, **height** and **font size** used by new notes
- Existing notes keep their own values

### Outline panel

- Click the extension icon → **"View Outline"**
- Lists all notes sorted by vertical position
- Click an item to scroll to the note and open editing
- Click the **×** on an item to delete the note from the outline

### Export / Import

- From the extension popup:
  - **Export**: downloads a JSON file with all notes from all URLs
  - **Import**: loads a JSON file and merges notes (without duplicating existing IDs)
- Works from any page, including restricted ones (`chrome://`), since it reads storage directly
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
  "posX_px": 350,
  "posY_px": 1200,
  "w_px": 170,
  "h_px": 325,
  "fontSize": 14
}
```

- `text` holds **sanitized HTML** (legacy plain-text notes are handled automatically)
- `w_px`/`h_px`/`fontSize` are optional; absent values fall back to the default settings

Notes are stored in `chrome.storage.local` with one key per URL:

```
absolute_note_https://example.com/page → [note1, note2, ...]
```

New-note preferences are stored globally under `absolute_note_settings`:

```json
{ "width": 170, "height": 325, "fontSize": 14 }
```

---

## Compatibility

- **Chrome** 88+ (Manifest V3)
- Works on static pages and **SPAs** (React, Vue, Angular, etc.)
- Supports `pushState`, `replaceState`, `popstate`, and `hashchange` navigation
- Correct positioning on manga readers like **Suwayomi** and **HeavenManga**

---

## License

GNU General Public License v3. See `LICENSE`.
