// App state, migration and local persistence.
//
// state = { version, activeBoard, boards: [board], settings, updatedAt }
// board = { id, name, pan, zoom, bg, bgImage, cards: [card], links: [{ id, a, b }] }
// Images live in a separate key so frequent saves (and sync) stay small.

import { uid } from './dom.js';

export const COLORS = ['#ffc857', '#ff6b6b', '#4ecdc4', '#7c83fd', '#a3e635', '#f472b6'];
export const STATE_KEY = 'board-state';
export const IMAGES_KEY = 'board-images';

export const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export const store = {
  state: null,
  images: {}, // imageId -> data URL
};

export const board = () => store.state.boards.find(b => b.id === store.state.activeBoard);

export function findCard(id) {
  for (const b of store.state.boards) {
    const card = b.cards.find(c => c.id === id);
    if (card) return { board: b, card };
  }
  return null;
}

export function newBoard(name = 'My board') {
  return { id: uid(), name, pan: { x: 0, y: 0 }, zoom: 1, bg: 'dots', bgImage: null, cards: [], links: [] };
}

// Accepts anything we've ever saved (v1 was { pan, cards }) and returns a valid v2 state.
export function migrate(raw) {
  let s = raw && typeof raw === 'object' ? raw : {};
  if (!Array.isArray(s.boards)) {
    const b = newBoard();
    if (Array.isArray(s.cards)) {
      b.cards = s.cards;
      b.pan = s.pan || b.pan;
    }
    s = { boards: [b], activeBoard: b.id, updatedAt: s.updatedAt, settings: s.settings };
  }
  s.version = 2;
  s.settings = { sync: true, ...(s.settings || {}) };
  s.updatedAt ||= 0;
  if (!s.boards.length) s.boards.push(newBoard());
  for (const b of s.boards) {
    b.id ||= uid();
    b.name ||= 'Board';
    b.pan ||= { x: 0, y: 0 };
    b.zoom ||= 1;
    b.bg ||= 'dots';
    b.cards ||= [];
    b.links ||= [];
    for (const c of b.cards) {
      c.id ||= uid();
      c.type ||= 'note';
      c.color ||= COLORS[0];
      c.w ||= 240;
      c.h ||= 170;
      c.x ??= 0;
      c.y ??= 0;
    }
  }
  if (!s.boards.some(b => b.id === s.activeBoard)) s.activeBoard = s.boards[0].id;
  return s;
}

// ---------- storage ----------

export async function readKey(key) {
  try {
    if (hasChrome) return (await chrome.storage.local.get(key))[key] ?? null;
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function writeKey(key, value) {
  if (hasChrome) return chrome.storage.local.set({ [key]: value });
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full (only happens when opened outside the extension)
  }
}

const saveHooks = [];  // run on every change (e.g. schedule a sync push)
const writeHooks = []; // run after each disk write (e.g. refresh alarms)
export const onSave = fn => saveHooks.push(fn);
export const onWrite = fn => writeHooks.push(fn);

let saveTimer = null;
export const hasPendingSave = () => saveTimer !== null;

export function save() {
  store.state.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 250);
  saveHooks.forEach(fn => fn());
}

// Writes immediately without bumping updatedAt (used when applying someone else's newer copy too).
export function writeNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  writeKey(STATE_KEY, store.state);
  writeHooks.forEach(fn => fn());
}

export const saveImages = () => writeKey(IMAGES_KEY, store.images);

// don't lose the last keystrokes if the tab closes mid-debounce
window.addEventListener('pagehide', () => { if (saveTimer) writeNow(); });
