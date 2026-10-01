// Top-right controls: board switcher and the ⋯ menu (backgrounds, sync, backups),
// plus the "add" menu you get by double-clicking the board.

import { $, h, uid } from './dom.js';
import { store, board, save, saveImages, migrate, newBoard } from './state.js';
import { icon } from './icons.js';
import { openMenu, toast } from './ui.js';
import { applyView, toWorld } from './view.js';
import { renderBoard, switchBoard, addCard, addImageCard } from './board.js';
import { CARD_TYPES } from './cards/index.js';
import { compressImage, pickImage } from './images.js';
import { toggleSync, syncNote, canSync } from './sync.js';

// ---------- add menu ----------

export function openAddMenu(sx, sy) {
  const at = toWorld(sx, sy);
  openMenu({ x: sx, y: sy }, [
    { heading: 'Add to board' },
    ...Object.entries(CARD_TYPES).map(([type, spec]) => ({
      label: spec.label + (type === 'image' ? '…' : ''),
      hint: type === 'note' ? 'N' : null,
      action: () => (type === 'image' ? pickImage(file => addImageCard(file, at)) : addCard(type, at)),
    })),
  ]);
}

// ---------- boards ----------

function boardMenu(anchor) {
  openMenu(anchor, [
    { heading: 'Boards' },
    ...store.state.boards.map((b, i) => ({
      label: b.name,
      checked: b.id === store.state.activeBoard,
      hint: i < 9 ? String(i + 1) : null,
      action: () => switchBoard(b.id),
    })),
    '-',
    { label: 'New board…', action: createBoard },
    { label: 'Rename this board…', action: renameBoard },
    store.state.boards.length > 1 ? { label: 'Delete this board', danger: true, action: deleteBoard } : null,
  ]);
}

function createBoard() {
  const name = prompt('Name your new board', 'New board')?.trim();
  if (!name) return;
  const b = newBoard(name);
  store.state.boards.push(b);
  switchBoard(b.id);
}

function renameBoard() {
  const name = prompt('Rename board', board().name)?.trim();
  if (!name) return;
  board().name = name;
  updateBoardButton();
  save();
}

function deleteBoard() {
  const b = board();
  const n = b.cards.length;
  if (!confirm(`Delete “${b.name}”${n ? ` and its ${n} card${n === 1 ? '' : 's'}` : ''}? This can't be undone.`)) return;
  store.state.boards = store.state.boards.filter(x => x !== b);
  store.state.activeBoard = store.state.boards[0].id;
  renderBoard();
  save();
}

function updateBoardButton() {
  $('#board-name').textContent = board().name;
}

// ---------- backgrounds ----------

function setBg(bg) {
  board().bg = bg;
  applyView();
  save();
}

async function setWallpaper(file) {
  try {
    const { url } = await compressImage(file, 2560);
    const b = board();
    if (b.bgImage) delete store.images[b.bgImage];
    b.bgImage = uid();
    store.images[b.bgImage] = url;
    b.bg = 'wallpaper';
    saveImages();
    applyView();
    save();
  } catch {
    toast("Couldn't use that image");
  }
}

// ---------- backups ----------

function exportBackup() {
  const data = { app: 'board', version: 2, state: store.state, images: store.images };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `board-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const raw = data.state || data; // v2 backups wrap state + images; v1 was just { pan, cards }
    if (!raw.boards && !raw.cards) throw new Error('not a backup');
    const next = migrate(raw);
    const count = next.boards.reduce((n, b) => n + b.cards.length, 0);
    if (!confirm(`Replace everything with this backup (${next.boards.length} board${next.boards.length === 1 ? '' : 's'}, ${count} cards)?`)) return;
    store.state = { ...next, settings: store.state.settings };
    store.images = { ...store.images, ...(data.images || {}) };
    saveImages();
    renderBoard();
    save();
    toast('Backup loaded');
  } catch {
    toast("That file doesn't look like a Board backup");
  }
}

function mainMenu(anchor) {
  const b = board();
  openMenu(anchor, [
    { heading: 'Background' },
    { label: 'Dots', checked: b.bg === 'dots', action: () => setBg('dots') },
    { label: 'Grid', checked: b.bg === 'grid', action: () => setBg('grid') },
    { label: 'Plain', checked: b.bg === 'plain', action: () => setBg('plain') },
    b.bgImage ? { label: 'Wallpaper', checked: b.bg === 'wallpaper', action: () => setBg('wallpaper') } : null,
    { label: b.bgImage ? 'Change wallpaper…' : 'Wallpaper…', action: () => pickImage(setWallpaper) },
    '-',
    { heading: 'Sync' },
    canSync() ? { label: 'Sync with my Chrome account', checked: store.state.settings.sync, action: toggleSync } : null,
    { note: syncNote() },
    '-',
    { label: 'Save backup', action: exportBackup },
    { label: 'Load backup…', action: () => $('#import').click() },
    '-',
    { note: 'Double-click the board to add cards · drop or paste images & links · N note · C show all · / search · ⌘/Ctrl + scroll to zoom · 1–9 switch boards' },
  ]);
}

export function initMenus() {
  const boardBtn = $('#board-btn');
  boardBtn.insertAdjacentHTML('beforeend', icon('chevron', 14));
  boardBtn.addEventListener('click', () => boardMenu(boardBtn));

  const menuBtn = $('#menu-btn');
  menuBtn.innerHTML = icon('more', 18);
  menuBtn.addEventListener('click', () => mainMenu(menuBtn));

  $('#import').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importBackup(file);
  });

  document.addEventListener('board:render', updateBoardButton);
  updateBoardButton();
}
