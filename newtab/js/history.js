// Undo / redo for everything on the boards.
//
// Every save() is compared with the last known content. If it changed, the previous
// content goes on the undo stack. A burst of typing in one field counts as one step;
// every other action (add, delete, drag, color…) is its own step. Camera (pan/zoom)
// and stacking order aren't undoable — undo never just moves the view around.

import { store, onSave, save } from './state.js';
import { toast } from './ui.js';
import { renderBoard } from './board.js';

const LIMIT = 100;
const GROUP_MS = 800;

let undoStack = [];
let redoStack = [];
let last = null;  // { key, json } of the current content
let lastAt = 0;
let lastField = null; // text field the previous change was typed into
let applying = false;

const textField = () => {
  const el = document.activeElement;
  return el?.matches('textarea, input:not([type]), input[type="text"]') ? el : null;
};

const contentKey = boards => JSON.stringify(boards.map(({ pan, zoom, ...b }) => ({
  ...b,
  cards: b.cards.map(({ z, ...c }) => c),
})));

const capture = () => ({
  key: contentKey(store.state.boards),
  json: JSON.stringify({ boards: store.state.boards, activeBoard: store.state.activeBoard }),
});

function record() {
  if (!last) return resetHistory();
  const cur = capture();
  if (cur.key !== last.key && !applying) {
    const now = Date.now();
    const field = textField();
    const sameTypingBurst = field && field === lastField && now - lastAt < GROUP_MS;
    if (!sameTypingBurst) {
      undoStack.push(last);
      if (undoStack.length > LIMIT) undoStack.shift();
    }
    lastAt = now;
    lastField = field;
    redoStack = [];
  }
  last = cur;
}

// forget history (after another tab or computer replaced our boards)
export function resetHistory() {
  undoStack = [];
  redoStack = [];
  last = capture();
  lastAt = 0;
  lastField = null;
}

function apply(entry) {
  const data = JSON.parse(entry.json);
  const cameras = new Map(store.state.boards.map(b => [b.id, { pan: b.pan, zoom: b.zoom }]));
  store.state.boards = data.boards;
  for (const b of store.state.boards) Object.assign(b, cameras.get(b.id) || {});
  const ids = new Set(store.state.boards.map(b => b.id));
  if (ids.has(data.activeBoard)) store.state.activeBoard = data.activeBoard;
  else if (!ids.has(store.state.activeBoard)) store.state.activeBoard = store.state.boards[0].id;
  applying = true;
  save();
  applying = false;
  lastField = null;
  renderBoard();
}

export function undo() {
  if (!undoStack.length) return toast('Nothing to undo');
  const entry = undoStack.pop();
  redoStack.push(last);
  apply(entry);
}

export function redo() {
  if (!redoStack.length) return toast('Nothing to redo');
  const entry = redoStack.pop();
  undoStack.push(last);
  apply(entry);
}

export function initHistory() {
  onSave(record);
  resetHistory();
}
