// Mouse, trackpad, keyboard, paste and drag-and-drop on the board.

import { $, isTyping } from './dom.js';
import { store, board, save } from './state.js';
import { viewport, world, linksSvg, applyView, toWorld, viewCenter, panBy, zoomAt, zoomBy, setZoom, centerView } from './view.js';
import { addCard, addImageCard, switchBoard } from './board.js';
import { isConnecting, cancelConnect } from './links.js';
import { closeFloating, isFloatingOpen } from './ui.js';
import { openAddMenu } from './menus.js';
import { normalizeUrl } from './cards/link.js';
import { parseEmbed, embedSize } from './cards/embed.js';
import { undo, redo } from './history.js';
import {
  selected, clearSelection, selectAll, deleteSelected, duplicateSelected,
  copySelected, pasteCards, startMarquee,
} from './selection.js';

const SCROLL_SPEED = 0.45; // how far the board moves per scroll step
const isEmptySpace = t => t === viewport || t === world || t === linksSvg;
const isImageUrl = text => /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(\?\S*)?$/i.test(text);

// Turn pasted/dropped text into the right kind of card.
function addFromText(text, at) {
  text = text.trim();
  if (!text) return;
  if (/<img[\s>]/i.test(text) || isImageUrl(text)) {
    const parsed = parseEmbed(text);
    if (parsed) return addCard('embed', at, { ...parsed, size: embedSize(parsed) });
  }
  const url = !/\s/.test(text) && normalizeUrl(text);
  if (url) return addCard('link', at, { url, title: new URL(url).hostname.replace(/^www\./, '') });
  addCard('note', at, { body: text });
}

function initPanning() {
  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !isEmptySpace(e.target)) return;
    if (isConnecting()) return cancelConnect();
    document.activeElement?.blur();
    if (e.shiftKey) return startMarquee(e);
    clearSelection();
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('panning');
    const b = board();
    const startX = e.clientX, startY = e.clientY, orig = { ...b.pan };

    const move = ev => {
      b.pan.x = orig.x + ev.clientX - startX;
      b.pan.y = orig.y + ev.clientY - startY;
      applyView();
    };
    const up = () => {
      viewport.classList.remove('panning');
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', up);
      viewport.removeEventListener('pointercancel', up);
      save();
    };
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
  });

  viewport.addEventListener('dblclick', e => {
    if (isEmptySpace(e.target)) openAddMenu(e.clientX, e.clientY);
  });

  // trackpad: two-finger scroll pans, pinch (or ⌘/Ctrl + scroll) zooms
  viewport.addEventListener('wheel', e => {
    const zooming = e.ctrlKey || e.metaKey;
    if (!zooming && e.target.closest('textarea, .check-list')) return; // let card contents scroll
    e.preventDefault();
    // clamp so one mouse-wheel notch is a gentle step, while trackpad pinches stay smooth
    if (zooming) zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-12, Math.min(12, e.deltaY)) * 0.01));
    else panBy(-e.deltaX * SCROLL_SPEED, -e.deltaY * SCROLL_SPEED);
  }, { passive: false });

  $('#zoom-in').addEventListener('click', () => zoomBy(1.2));
  $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.2));
  $('#zoom-level').addEventListener('click', () => setZoom(1));
}

function initKeyboard() {
  document.addEventListener('keydown', e => {
    const typing = isTyping(e.target);
    if (e.key === 'Escape') {
      if (isFloatingOpen()) closeFloating();
      else if (isConnecting()) cancelConnect();
      else if (typing) e.target.blur();
      else clearSelection();
      return;
    }
    if (typing) return; // fields keep their own undo, copy and paste
    const key = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (key === 'y') { e.preventDefault(); redo(); }
      else if (key === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (key === 'a') { e.preventDefault(); selectAll(); }
      return;
    }
    if (e.altKey) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) { e.preventDefault(); deleteSelected(); }
    else if (key === 'n') { e.preventDefault(); addCard('note'); }
    else if (key === 'c') centerView();
    else if (key === '0') setZoom(1);
    else if (key === '=' || key === '+') zoomBy(1.2);
    else if (key === '-') zoomBy(1 / 1.2);
    else if (key === '/') { e.preventDefault(); $('#search input').focus(); }
    else if (/^[1-9]$/.test(key)) {
      const b = store.state.boards[Number(key) - 1];
      if (b) switchBoard(b.id);
    }
  });
}

function initPasteAndDrop() {
  document.addEventListener('copy', e => {
    if (isTyping(e.target) || String(getSelection())) return;
    copySelected(e);
  });

  document.addEventListener('paste', e => {
    if (isTyping(e.target)) return;
    if (pasteCards(e.clipboardData.getData('text/plain'))) {
      e.preventDefault();
      return;
    }
    const file = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      return addImageCard(file, viewCenter());
    }
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (text || html) {
      e.preventDefault();
      addFromText(text || html, viewCenter());
    }
  });

  // never let a dropped file navigate away from the board
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  viewport.addEventListener('drop', e => {
    e.preventDefault();
    let at = toWorld(e.clientX, e.clientY);
    const images = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (images.length) {
      images.forEach((file, i) => addImageCard(file, { x: at.x + i * 30, y: at.y + i * 30 }));
      return;
    }
    const text = e.dataTransfer.getData('text/uri-list').split('\n').find(l => l && !l.startsWith('#'))
      || e.dataTransfer.getData('text/plain');
    if (text) addFromText(text, at);
  });
}

export function initInput() {
  initPanning();
  initKeyboard();
  initPasteAndDrop();
}
