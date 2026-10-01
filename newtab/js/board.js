// Cards on the board: building, dragging, resizing, adding, deleting, switching boards.

import { store, board, findCard, save, saveImages, COLORS } from './state.js';
import { h, uid } from './dom.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { world, linksSvg, screenLayer, applyView, viewCenter, glide, toWorld } from './view.js';
import { CARD_TYPES } from './cards/index.js';
import { openReminder, reminderChip } from './reminders.js';
import { drawLinks, startConnect, finishConnect, isConnecting, cancelConnect } from './links.js';
import { applySearchDim } from './search.js';
import { compressImage } from './images.js';
import { selected, selectedCards, toggleSelected, clearSelection, paintSelection, setActiveCard } from './selection.js';
import { snapPosition, showGuides, hideGuides } from './snap.js';
import { undo } from './history.js';

export const cardEls = new Map(); // card id -> element (current board only)
let topZ = 1;
export const nextZ = () => ++topZ;

// remember sizes after the user drags the resize corner
const resizeObserver = new ResizeObserver(entries => {
  let changed = false;
  for (const { target } of entries) {
    const card = board().cards.find(c => c.id === target.dataset.id);
    const w = target.offsetWidth, ht = target.offsetHeight;
    if (card && w && ht && (w !== card.w || ht !== card.h)) {
      card.w = w;
      card.h = ht;
      changed = true;
    }
  }
  if (changed) {
    drawLinks();
    save();
  }
});

export function renderBoard() {
  cancelConnect();
  resizeObserver.disconnect();
  cardEls.clear();
  world.replaceChildren(linksSvg);
  screenLayer.replaceChildren();
  const b = board();
  topZ = Math.max(1, ...b.cards.map(c => c.z || 1));
  b.cards.forEach(card => mountCard(card));
  applyView();
  drawLinks();
  applySearchDim();
  paintSelection();
  document.dispatchEvent(new CustomEvent('board:render'));
}

// (re)build one card's element in place
export function mountCard(card, fresh = false) {
  const el = buildCard(card);
  if (fresh) el.classList.add('fresh');
  const old = cardEls.get(card.id);
  if (old) {
    resizeObserver.unobserve(old);
    old.replaceWith(el);
  } else {
    (card.onScreen ? screenLayer : world).appendChild(el);
  }
  cardEls.set(card.id, el);
  resizeObserver.observe(el);
  return el;
}

function tool(name, title, onclick, { on = false, cls = '' } = {}) {
  return h('button', { class: `tool ${cls}${on ? ' on' : ''}`, title, html: icon(name), onclick });
}

function buildCard(card) {
  const type = CARD_TYPES[card.type] || CARD_TYPES.note;
  if (card.onScreen) clampToScreen(card);
  const cls = `card type-${card.type}${card.pinned ? ' pinned' : ''}${card.onScreen ? ' on-screen' : ''}${selected.has(card.id) ? ' selected' : ''}`;
  const el = h('article', { class: cls, 'data-id': card.id });
  Object.assign(el.style, {
    left: card.x + 'px',
    top: card.y + 'px',
    width: card.w + 'px',
    height: card.h + 'px',
    zIndex: card.z || 1,
  });
  el.style.setProperty('--c', card.color);

  const swatches = COLORS.map((color, i) => h('button', {
    class: 'swatch' + (color === card.color ? ' on' : ''),
    title: 'Card color',
    style: { background: color },
    onclick: () => {
      card.color = color;
      el.style.setProperty('--c', color);
      swatches.forEach((s, j) => s.classList.toggle('on', i === j));
      drawLinks();
      save();
    },
  }));

  const bar = h('div', { class: 'card-bar' },
    h('div', { class: 'swatches' }, swatches),
    h('div', { class: 'tools' },
      tool('link', 'Connect to another card', () => startConnect(card)),
      tool('bell', 'Reminder', e => openReminder(card, e.currentTarget), { on: !!card.remindAt }),
      tool('screen', card.onScreen ? 'Put back on the board' : 'Keep on screen (stays put when you pan or zoom)',
        () => toggleOnScreen(card), { on: !!card.onScreen }),
      tool('pin', card.pinned ? 'Unpin' : 'Pin in place', () => {
        card.pinned = !card.pinned;
        mountCard(card);
        save();
      }, { on: card.pinned, cls: 'pin' }),
      tool('x', 'Delete card', () => deleteCards([card]), { cls: 'del' })));

  const ctx = { el, save, rerender: () => mountCard(card) };
  el.append(bar);
  if (type.hasTitle !== false) {
    el.append(h('input', {
      class: 'card-title',
      value: card.title || '',
      placeholder: type.titlePlaceholder || 'Title',
      maxLength: 80,
      oninput: e => { card.title = e.target.value; save(); },
      onkeydown: e => {
        if (e.key === 'Enter') el.querySelector('.card-content input, .card-content textarea')?.focus();
      },
    }));
  }
  el.append(h('div', { class: 'card-content' }, type.build(card, ctx)));
  const chip = reminderChip(card);
  if (chip) el.append(chip);

  // capture phase so connect mode wins over everything inside the card
  el.addEventListener('pointerdown', e => {
    if (isConnecting()) {
      e.preventDefault();
      e.stopPropagation();
      swallowNextClick();
      finishConnect(card);
      return;
    }
    // Shift-click adds/removes from the selection (unless extending text selection in a field)
    if (e.shiftKey && !(e.target.matches('input, textarea') && e.target === document.activeElement)) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelected(card.id);
      return;
    }
    bringToFront(el, card);
    setActiveCard(card.id);
    // clicking a card outside the current selection drops the selection
    if (selected.size && !selected.has(card.id)) clearSelection();
  }, true);

  enableDrag(bar, el, card);
  return el;
}

// the click that follows the connecting pointerdown shouldn't also press whatever was under it
// ---------- keep on screen ----------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// keep screen cards visible when the window is smaller than when they were placed
function clampToScreen(card) {
  card.x = Math.round(clamp(card.x, 8, innerWidth - card.w - 8));
  card.y = Math.round(clamp(card.y, 8, innerHeight - card.h - 8));
}

// switch between board coordinates and screen pixels so the card doesn't jump
function toggleOnScreen(card) {
  const b = board();
  if (card.onScreen) {
    const p = toWorld(card.x, card.y);
    card.x = Math.round(p.x);
    card.y = Math.round(p.y);
    card.onScreen = false;
  } else {
    card.x = Math.round(b.pan.x + card.x * b.zoom);
    card.y = Math.round(b.pan.y + card.y * b.zoom);
    card.onScreen = true;
    selected.delete(card.id);
  }
  const old = cardEls.get(card.id);
  resizeObserver.unobserve(old);
  old.remove();
  cardEls.delete(card.id);
  mountCard(card);
  drawLinks();
  save();
}

window.addEventListener('resize', () => {
  for (const card of board().cards) if (card.onScreen) mountCard(card);
});

function swallowNextClick() {
  const swallow = e => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
}

function bringToFront(el, card) {
  if (card.z === topZ) return;
  card.z = ++topZ;
  el.style.zIndex = card.z;
  save();
}

// Drags the card — and the rest of the selection with it — snapping to other cards.
function enableDrag(bar, el, card) {
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || card.pinned || e.target.closest('button')) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    const b = board();
    const zoom = card.onScreen ? 1 : b.zoom; // screen cards move in screen pixels
    const group = !card.onScreen && selected.has(card.id) && selected.size > 1
      ? selectedCards().filter(c => !c.pinned && !c.onScreen)
      : [card];
    const moving = new Set(group.map(c => c.id));
    const others = b.cards.filter(c => !moving.has(c.id) && !!c.onScreen === !!card.onScreen);
    const origin = new Map(group.map(c => [c.id, { x: c.x, y: c.y }]));
    const startX = e.clientX, startY = e.clientY;
    const snapOn = store.state.settings.snap !== false;
    group.forEach(c => cardEls.get(c.id)?.classList.add('dragging'));

    const move = ev => {
      const o = origin.get(card.id);
      let x = o.x + (ev.clientX - startX) / zoom;
      let y = o.y + (ev.clientY - startY) / zoom;
      if (snapOn && !ev.altKey) {
        const snapped = snapPosition({ x, y, w: card.w, h: card.h }, others, zoom);
        x = snapped.x;
        y = snapped.y;
        showGuides(snapped.guides, zoom);
      } else {
        hideGuides();
      }
      const dx = Math.round(x - o.x), dy = Math.round(y - o.y);
      for (const c of group) {
        const start = origin.get(c.id);
        c.x = start.x + dx;
        c.y = start.y + dy;
        const cel = cardEls.get(c.id);
        cel.style.left = c.x + 'px';
        cel.style.top = c.y + 'px';
      }
      drawLinks();
    };
    const up = () => {
      hideGuides();
      group.forEach(c => cardEls.get(c.id)?.classList.remove('dragging'));
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      save();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
}

// ---------- adding & removing ----------

export function addCard(type, at = viewCenter(), extra = {}) {
  const spec = CARD_TYPES[type];
  const { size, ...fields } = extra;
  const [w, ht] = size || spec.size;
  const b = board();
  const card = {
    id: uid(),
    type,
    x: Math.round(at.x - w / 2),
    y: Math.round(at.y - 24),
    w,
    h: ht,
    z: ++topZ,
    title: '',
    color: COLORS[b.cards.length % COLORS.length],
    pinned: false,
    remindAt: null,
    ...spec.defaults(),
    ...fields,
  };
  b.cards.push(card);
  const el = mountCard(card, true);
  save();
  if (spec.focus !== null) el.querySelector(spec.focus || '.card-title')?.focus();
  return card;
}

export async function addImageCard(file, at) {
  try {
    const { url, width, height } = await compressImage(file, 1600);
    const imageId = uid();
    store.images[imageId] = url;
    saveImages();
    const w = 280;
    const ht = Math.min(600, Math.max(140, Math.round((w * height) / width) + 50));
    addCard('image', at, { imageId, size: [w, ht] });
  } catch {
    toast("Couldn't read that image");
  }
}

export function deleteCards(cards) {
  if (!cards.length) return;
  const b = board();
  const ids = new Set(cards.map(c => c.id));
  b.cards = b.cards.filter(c => !ids.has(c.id));
  b.links = b.links.filter(l => !ids.has(l.a) && !ids.has(l.b));
  for (const id of ids) {
    const el = cardEls.get(id);
    resizeObserver.unobserve(el);
    el.remove();
    cardEls.delete(id);
    selected.delete(id);
  }
  drawLinks();
  save();
  toast(cards.length === 1 ? 'Card deleted' : `${cards.length} cards deleted`, { label: 'Undo', action: undo });
}

// ---------- boards ----------

export function switchBoard(id) {
  if (id === store.state.activeBoard) return;
  store.state.activeBoard = id;
  renderBoard();
  save();
  toast(board().name, { ms: 1200 });
}

export function focusCard(id) {
  const found = findCard(id);
  if (!found) return;
  if (found.board.id !== store.state.activeBoard) switchBoard(found.board.id);
  const b = board(), c = found.card;
  if (b.zoom < 0.6) b.zoom = 1;
  b.pan.x = Math.round(innerWidth / 2 - (c.x + c.w / 2) * b.zoom);
  b.pan.y = Math.round(innerHeight / 2 + 40 - (c.y + c.h / 2) * b.zoom);
  glide();
  applyView();
  save();
  const el = cardEls.get(id);
  bringToFront(el, c);
  el.classList.remove('flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('flash');
}
