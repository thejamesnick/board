// Cards on the board: building, dragging, resizing, adding, deleting, switching boards.

import { store, board, findCard, save, saveImages, COLORS } from './state.js';
import { h, uid } from './dom.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { world, linksSvg, applyView, viewCenter, glide } from './view.js';
import { CARD_TYPES } from './cards/index.js';
import { openReminder, reminderChip } from './reminders.js';
import { drawLinks, startConnect, finishConnect, isConnecting, cancelConnect } from './links.js';
import { applySearchDim } from './search.js';
import { compressImage } from './images.js';

export const cardEls = new Map(); // card id -> element (current board only)
let topZ = 1;

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
  const b = board();
  topZ = Math.max(1, ...b.cards.map(c => c.z || 1));
  b.cards.forEach(card => mountCard(card));
  applyView();
  drawLinks();
  applySearchDim();
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
    world.appendChild(el);
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
  const el = h('article', { class: `card type-${card.type}${card.pinned ? ' pinned' : ''}`, 'data-id': card.id });
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
      tool('pin', card.pinned ? 'Unpin' : 'Pin in place', () => {
        card.pinned = !card.pinned;
        mountCard(card);
        save();
      }, { on: card.pinned, cls: 'pin' }),
      tool('x', 'Delete card', () => deleteCard(card), { cls: 'del' })));

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
    } else {
      bringToFront(el, card);
    }
  }, true);

  enableDrag(bar, el, card);
  return el;
}

// the click that follows the connecting pointerdown shouldn't also press whatever was under it
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

function enableDrag(bar, el, card) {
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || card.pinned || e.target.closest('button')) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const zoom = board().zoom;
    const startX = e.clientX, startY = e.clientY, origX = card.x, origY = card.y;

    const move = ev => {
      card.x = Math.round(origX + (ev.clientX - startX) / zoom);
      card.y = Math.round(origY + (ev.clientY - startY) / zoom);
      el.style.left = card.x + 'px';
      el.style.top = card.y + 'px';
      drawLinks();
    };
    const up = () => {
      el.classList.remove('dragging');
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

export function deleteCard(card) {
  const b = board();
  const index = b.cards.indexOf(card);
  const removedLinks = b.links.filter(l => l.a === card.id || l.b === card.id);
  b.cards.splice(index, 1);
  b.links = b.links.filter(l => !removedLinks.includes(l));
  const el = cardEls.get(card.id);
  resizeObserver.unobserve(el);
  el.remove();
  cardEls.delete(card.id);
  drawLinks();
  save();

  toast('Card deleted', {
    label: 'Undo',
    action: () => {
      b.cards.splice(index, 0, card);
      b.links.push(...removedLinks);
      if (board() === b) {
        mountCard(card, true);
        drawLinks();
      }
      save();
    },
    onExpire: () => {
      // free the image once undo is no longer possible
      if (card.imageId && !findCardUsingImage(card.imageId)) {
        delete store.images[card.imageId];
        saveImages();
      }
    },
  });
}

const findCardUsingImage = id => store.state.boards.some(b => b.cards.some(c => c.imageId === id));

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
