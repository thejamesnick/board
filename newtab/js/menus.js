// Top-right controls: board switcher and the ⋯ menu (backgrounds, sync, backups),
// plus the "add" menu you get by double-clicking the board.

import { $, h, uid } from './dom.js';
import { store, board, save, saveImages, migrate, newBoard } from './state.js';
import { icon } from './icons.js';
import { openMenu, toast } from './ui.js';
import { applyView, toWorld, viewCenter } from './view.js';
import { renderBoard, switchBoard, addCard, addImageCard } from './board.js';
import { CARD_TYPES } from './cards/index.js';
import { compressImage, pickImage } from './images.js';
import { toggleSync, syncNote, canSync } from './sync.js';
import { listSnapshots, takeSnapshot, restoreSnapshot, countCards } from './snapshots.js';
import { seedWelcome } from './welcome.js';
import { backupJson, backupNow, backupNote, canBackupToDisk, chooseBackupFile, releaseHold } from './autobackup.js';
import { mountCard } from './board.js';
import { drawLinks } from './links.js';

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

async function deleteBoard() {
  const b = board();
  const n = b.cards.length;
  if (!confirm(`Delete “${b.name}”${n ? ` and its ${n} card${n === 1 ? '' : 's'}` : ''}? (You can undo with ⌘Z.)`)) return;
  await takeSnapshot('before deleting a board');
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
    b.bgImage = uid(); // the old image is cleaned up later, so undo can still bring it back
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
  const blob = new Blob([backupJson()], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `board-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importBackup(file) {
  try {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast(`${file.name} isn't a Board backup (it isn't a JSON file)`, { ms: 5000 });
      return false;
    }
    const raw = data.state || data; // v2 backups wrap state + images; v1 was just { pan, cards }
    if (!raw.boards && !raw.cards) throw new Error('not a backup');
    const next = migrate(raw);
    const count = next.boards.reduce((n, b) => n + b.cards.length, 0);
    if (!confirm(`Replace everything with this backup (${next.boards.length} board${next.boards.length === 1 ? '' : 's'}, ${count} cards)?`)) return false;
    await takeSnapshot('before loading a backup');
    store.state = { ...next, settings: store.state.settings };
    store.images = { ...store.images, ...(data.images || {}) };
    saveImages();
    renderBoard();
    releaseHold(); // a restored board is safe to back up again
    toast('Backup loaded');
    return true;
  } catch {
    toast(`${file.name} doesn't look like a Board backup`, { ms: 5000 });
    return false;
  }
}

async function backupFromMenu() {
  if (store.state.settings.backupHold) return toast('Restore your backup or choose Start fresh first', { ms: 4000 });
  const ok = await backupNow({ interactive: true });
  toast(ok ? 'Backup saved' : backupNote(), { ms: ok ? 2500 : 7000 });
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
    { label: 'Snap cards into line', checked: store.state.settings.snap !== false, action: toggleSnap },
    { label: 'Add welcome tips', action: addTips },
    '-',
    canBackupToDisk() ? { label: 'Back up now', action: backupFromMenu } : null,
    { note: backupNote() },
    { label: 'Save backup', action: exportBackup },
    { label: 'Load backup…', action: async () => { const file = await chooseBackupFile(); if (file) importBackup(file); } },
    { label: 'Restore a snapshot…', action: () => snapshotMenu(anchor) },
    '-',
    { note: 'Double-click to add · Shift-drag to select · ⌘Z undo · ⌘D duplicate · ⌘C/⌘V copy cards · Delete removes · N note · C show all · / search · ⌘ + scroll zoom · Alt-drag skips snapping · 1–9 boards' },
  ]);
}

function toggleSnap() {
  store.state.settings.snap = store.state.settings.snap === false;
  save();
}

function addTips() {
  const cards = seedWelcome(viewCenter());
  cards.forEach(c => mountCard(c, true));
  drawLinks();
  save();
}

async function snapshotMenu(anchor) {
  const list = await listSnapshots();
  const r = anchor.getBoundingClientRect();
  openMenu({ x: r.right - 280, y: r.bottom }, [
    { heading: 'Snapshots' },
    ...list.map(snap => ({
      label: `${new Date(snap.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} · ${countCards(snap.state)} cards`,
      hint: snap.reason === 'daily' ? null : '•',
      action: () => {
        if (confirm(`Restore the snapshot from ${new Date(snap.at).toLocaleString()} (${snap.reason})? You can undo with ⌘Z.`)) restoreSnapshot(snap);
      },
    })),
    list.length ? { note: 'Taken daily and before big changes (• marks those).' } : { note: 'No snapshots yet. One is taken every day.' },
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
