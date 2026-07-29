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
- **Inline editing**: click the body or the ✏️ button to edit, click outside to save
- **Lock/unlock** individual notes (disables editing and dragging)
- **Per-URL persistence**: each page saves its own notes in `chrome.storage.local`
- **SPA support** (React, etc.): detects URL changes and reloads notes automatically
- **Outline panel**: side panel listing all notes sorted by position, with navigation and deletion
- **Export and import** all notes as JSON
- **Resizable**: drag the bottom-right corner of the note body

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
| `background.js` | Service worker: creates the "Add Note" context menu item |
| `content.js` | Core logic: notes, drag, outline, import/export, SPA detection |
| `styles.css` | Styles for notes, colors, outline, and buttons |
| `popup.html` | Popup window with outline, export, and import options |
| `popup.js` | Sends actions from the popup to the content script |
| `icon.png` | Extension icon |

---

## Usage

### Create a note

- **Right-click** anywhere on the page → **"Absolute Note: Add Note"**
- The note appears at the click position, ready for typing

### Edit

- Click the note body, or click the ✏️ button in the header
- The cursor is placed at the end of existing text
- Click outside to save

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

### Outline panel

- Click the extension icon → **"View Outline"**
- Lists all notes sorted by vertical position
- Click an item to scroll to the note and open editing
- Click the **×** on an item to delete the note from the outline

### Export / Import

- From the extension popup:
  - **Export**: downloads a JSON file with all notes from all URLs
  - **Import**: loads a JSON file and merges notes (without duplicating existing IDs)

---

## Data structure

Each note is stored with this structure:

```json
{
  "id": "lorem123",
  "text": "Note content",
  "locked": false,
  "colorIndex": 0,
  "posX_px": 350,
  "posY_px": 1200
}
```

Notes are stored in `chrome.storage.local` with one key per URL:

```
absolute_note_https://example.com/page → [note1, note2, ...]
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
