<p align="center"><img src="docs/icon.png" width="96" alt="Board icon"></p>

<h1 align="center">Board</h1>

<p align="center">Your own world on every new tab — a Chrome new tab page where everything is a card you can drag around.</p>

![Board screenshot](docs/screenshot.png)

## Features

- **Infinite canvas** — drag empty space to move around, pinch or ⌘/Ctrl + scroll to zoom, press **C** to see everything
- **Card types** — notes, checklists, links (with site icons), images, countdowns, and embeds/badges (paste a Product Hunt badge or any image link)
- **Connect cards** with lines, like a detective board
- **Reminders** on any card — a desktop notification fires even with no tab open
- **Undo / redo everything** (⌘Z / ⇧⌘Z) — typing, moving, deleting, colors, whole boards
- **Select several cards** with Shift-click or Shift-drag, then move, duplicate (⌘D), copy/paste (⌘C/⌘V, even between boards) or delete them together
- **Snapping** with alignment guides while dragging (hold Alt/Option to drag freely)
- **Pin** cards in place, recolor them, resize from the corner
- **Search** across all your cards from the top bar (Enter with nothing selected searches the web)
- **Multiple boards** — switch with the board menu or keys **1–9**
- **Backgrounds** — dots, grid, plain, or your own wallpaper
- **Sync** text across computers through your Chrome account; backups to a file
- **Automatic backup file** — a copy of everything is saved as `board-autobackup.json` in your Chrome downloads folder, so removing the extension (which erases its storage) doesn't lose your boards. After a reinstall, use **Restore backup**. Turn off Chrome's "Ask where to save each file" so it can run on its own
- **Automatic snapshots** daily and before big changes — restore any of them from the ⋯ menu
- **Welcome cards** for first-time users that teach the gestures
- **Drop or paste** images, links and text straight onto the board
- A rolling serif clock, and a matching dark Chrome theme

Everything saves automatically to your browser. Nothing is sent anywhere except Chrome sync (if you leave it on). Note that Chrome only syncs extensions installed from the Web Store, not ones loaded unpacked.

## Install

1. Download or clone this repo
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and choose the `newtab` folder
4. Optional: **Load unpacked** again and choose the `theme` folder for the matching browser theme
5. Open a new tab and click **Keep it** when Chrome asks

## Shortcuts

| Key | Action |
| --- | --- |
| Double-click board | Add a card |
| Shift-drag / Shift-click | Select several cards |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘D` | Duplicate selection |
| `⌘C` / `⌘V` | Copy / paste cards |
| `⌘A` | Select all |
| `Delete` | Delete selection |
| `N` | New note |
| `C` | Show all cards |
| `/` | Search |
| `0` / `+` / `-` | Reset / zoom in / zoom out |
| `1`–`9` | Switch boards |
| `Esc` | Close menus, cancel connecting, clear selection |
| Alt + drag | Move without snapping |

## Project layout

```
newtab/                 the extension
  newtab.html           page shell
  background.js         service worker: reminder notifications
  css/                  base, topbar, board, cards, ui
  js/
    main.js             entry point
    state.js            state, migration, saving
    board.js            cards: build, drag, resize, add, delete
    cards/              one file per card type + index.js registry
    links.js            connections between cards
    selection.js        select, duplicate, copy/paste, box select
    history.js          undo / redo
    snap.js             snapping + alignment guides
    snapshots.js        automatic safety copies
    welcome.js          first-run cards
    view.js             pan, zoom, background
    input.js            mouse, keyboard, paste, drop
    menus.js            board switcher, ⋯ menu, add menu, backups
    search.js           card search
    sync.js             cross-tab and Chrome account sync
    autobackup.js       backup file in Downloads, restore banner
    reminders.js        reminder popover + alarms
    clock.js, ui.js, dom.js, icons.js, images.js
theme/                  matching dark Chrome theme
design/                 icon source
```

**Adding a card type:** create `newtab/js/cards/yourtype.js` exporting `{ label, size, defaults, build, text }` and register it in `cards/index.js`.

No build step, no dependencies — plain HTML, CSS and ES modules.

What's coming next: see [ROADMAP.md](ROADMAP.md).

## License

MIT
