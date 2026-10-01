// Selecting cards (click, Shift-click, Shift-drag a box) and acting on the selection:
// delete, duplicate, copy and paste — also between boards.

import { board, save, COLORS } from './state.js';
import { h, uid } from './dom.js';
import { toast } from './ui.js';
import { viewport, toWorld, viewCenter } from './view.js';
import { cardEls, mountCard, deleteCards, nextZ } from './board.js';
import { drawLinks } from './links.js';

export const selected = new Set();
let activeId = null; // last card clicked; ⌘C/⌘D use it when nothing is selected
export const setActiveCard = id => { activeId = id; };
const CLIP_MARK = 'board-cards:';

export function paintSelection() {
  for (const id of selected) if (!cardEls.has(id)) selected.delete(id);
  for (const [id, el] of cardEls) el.classList.toggle('selected', selected.has(id));
}

export function setSelection(ids) {
  selected.clear();
  ids.forEach(id => selected.add(id));
  paintSelection();
}

export function toggleSelected(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  paintSelection();
}

export function clearSelection() {
  if (!selected.size) return;
  selected.clear();
  paintSelection();
}

export const selectedCards = () => board().cards.filter(c => selected.has(c.id));

const targetCards = () => {
  if (selected.size) return selectedCards();
  const active = board().cards.find(c => c.id === activeId);
  return active ? [active] : [];
};

export const selectAll = () => setSelection(board().cards.filter(c => !c.onScreen).map(c => c.id));

export function deleteSelected() {
  const cards = selectedCards();
  if (!cards.length) return;
  selected.clear();
  deleteCards(cards);
}

// ---------- duplicate / copy / paste ----------

// fresh copies of `cards` (and the links between them), moved by (dx, dy)
function cloneGroup(cards, links, dx, dy) {
  const ids = new Map(cards.map(c => [c.id, uid()]));
  const copies = cards.map(c => ({
    ...structuredClone(c),
    id: ids.get(c.id),
    x: Math.round(c.x + dx),
    y: Math.round(c.y + dy),
    z: nextZ(),
    remindAt: null,
    onScreen: false,
    items: c.items?.map(i => ({ ...i, id: uid() })),
  }));
  const newLinks = links
    .filter(l => ids.has(l.a) && ids.has(l.b))
    .map(l => ({ id: uid(), a: ids.get(l.a), b: ids.get(l.b) }));
  return { copies, newLinks };
}

function place(copies, newLinks) {
  const b = board();
  copies.forEach(c => { c.color ||= COLORS[0]; });
  b.cards.push(...copies);
  b.links.push(...newLinks);
  copies.forEach(c => mountCard(c, true));
  drawLinks();
  setSelection(copies.map(c => c.id));
  save();
}

export function duplicateSelected() {
  const cards = targetCards();
  if (!cards.length) return toast('Click a card first');
  const { copies, newLinks } = cloneGroup(cards, board().links, 28, 28);
  place(copies, newLinks);
}

// 'copy' event handler; returns true if it copied cards
export function copySelected(e) {
  const cards = targetCards();
  if (!cards.length) return false;
  const ids = new Set(cards.map(c => c.id));
  const links = board().links.filter(l => ids.has(l.a) && ids.has(l.b));
  e.clipboardData.setData('text/plain', CLIP_MARK + JSON.stringify({ cards, links }));
  e.preventDefault();
  toast(`Copied ${cards.length} card${cards.length === 1 ? '' : 's'}`);
  return true;
}

// pasted text; returns true if it was cards copied from a board
export function pasteCards(text) {
  if (!text?.startsWith(CLIP_MARK)) return false;
  let data;
  try {
    data = JSON.parse(text.slice(CLIP_MARK.length));
  } catch {
    return false;
  }
  if (!Array.isArray(data.cards) || !data.cards.length) return false;
  const minX = Math.min(...data.cards.map(c => c.x)), maxX = Math.max(...data.cards.map(c => c.x + c.w));
  const minY = Math.min(...data.cards.map(c => c.y)), maxY = Math.max(...data.cards.map(c => c.y + c.h));
  const at = viewCenter();
  const { copies, newLinks } = cloneGroup(data.cards, data.links || [], at.x - (minX + maxX) / 2, at.y - (minY + maxY) / 2);
  place(copies, newLinks);
  return true;
}

// ---------- box select (Shift + drag on empty space) ----------

export function startMarquee(e) {
  const box = h('div', { class: 'marquee' });
  document.body.append(box);
  const sx = e.clientX, sy = e.clientY;
  const base = new Set(selected);
  viewport.setPointerCapture(e.pointerId);

  const move = ev => {
    const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY);
    const x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
    Object.assign(box.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
    const a = toWorld(x1, y1), b = toWorld(x2, y2);
    const hit = board().cards
      .filter(c => !c.onScreen && c.x < b.x && c.x + c.w > a.x && c.y < b.y && c.y + c.h > a.y)
      .map(c => c.id);
    setSelection([...base, ...hit]);
  };
  const up = () => {
    box.remove();
    viewport.removeEventListener('pointermove', move);
    viewport.removeEventListener('pointerup', up);
    viewport.removeEventListener('pointercancel', up);
  };
  viewport.addEventListener('pointermove', move);
  viewport.addEventListener('pointerup', up);
  viewport.addEventListener('pointercancel', up);
}
