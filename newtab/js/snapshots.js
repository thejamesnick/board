// Safety net: automatic copies of everything, kept inside the browser.
// One a day, plus one before anything big (loading a backup, deleting a board,
// another computer's sync replacing this one). Restoring is itself undoable.

import { store, readKey, writeKey, migrate, save } from './state.js';
import { renderBoard } from './board.js';
import { toast } from './ui.js';

const KEY = 'board-snapshots';
const MAX = 14;
const DAY = 86400e3;

export const listSnapshots = async () => (await readKey(KEY)) || [];

export async function takeSnapshot(reason) {
  const list = await listSnapshots();
  list.unshift({ at: Date.now(), reason, state: structuredClone(store.state) });
  await writeKey(KEY, list.slice(0, MAX));
}

export async function dailySnapshot() {
  const list = await listSnapshots();
  if (!list.some(s => s.reason === 'daily' && Date.now() - s.at < DAY)) await takeSnapshot('daily');
}

// at most one per hour, for frequent events like incoming sync
export async function snapshotOnce(reason) {
  const list = await listSnapshots();
  if (!list.some(s => s.reason === reason && Date.now() - s.at < 3600e3)) await takeSnapshot(reason);
}

export function restoreSnapshot(snap) {
  const settings = store.state.settings;
  const next = migrate(structuredClone(snap.state));
  store.state.boards = next.boards;
  store.state.activeBoard = next.activeBoard;
  store.state.settings = settings;
  renderBoard();
  save();
  toast('Snapshot restored · ⌘Z to go back');
}

export const countCards = state => state.boards.reduce((n, b) => n + b.cards.length, 0);
