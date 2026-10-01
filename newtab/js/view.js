// Camera: panning, zooming and the board background.

import { $ } from './dom.js';
import { store, board, save } from './state.js';

export const viewport = $('#viewport');
export const world = $('#world');
export const linksSvg = $('#links');

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
const clampZoom = z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function applyView() {
  const b = board();
  world.style.transform = `translate(${b.pan.x}px, ${b.pan.y}px) scale(${b.zoom})`;
  viewport.style.setProperty('--grid', 28 * b.zoom + 'px');
  viewport.style.setProperty('--px', b.pan.x + 'px');
  viewport.style.setProperty('--py', b.pan.y + 'px');
  const wallpaper = b.bg === 'wallpaper' && store.images[b.bgImage];
  viewport.dataset.bg = wallpaper || b.bg !== 'wallpaper' ? b.bg : 'dots';
  viewport.style.setProperty('--wallpaper', wallpaper ? `url("${wallpaper}")` : 'none');
  $('#zoom-level').textContent = Math.round(b.zoom * 100) + '%';
}

// screen point -> board coordinates
export function toWorld(sx, sy) {
  const b = board();
  return { x: (sx - b.pan.x) / b.zoom, y: (sy - b.pan.y) / b.zoom };
}

export const viewCenter = () => toWorld(innerWidth / 2, innerHeight / 2 + 30);

export function panBy(dx, dy) {
  const b = board();
  b.pan.x += dx;
  b.pan.y += dy;
  applyView();
  save();
}

// zoom keeping the board point under (sx, sy) fixed
export function zoomAt(sx, sy, factor) {
  const b = board();
  const z = clampZoom(b.zoom * factor);
  const p = toWorld(sx, sy);
  b.zoom = z;
  b.pan.x = sx - p.x * z;
  b.pan.y = sy - p.y * z;
  applyView();
  save();
}

export const zoomBy = factor => zoomAt(innerWidth / 2, innerHeight / 2, factor);
export const setZoom = z => zoomAt(innerWidth / 2, innerHeight / 2, z / board().zoom);

// animate the next camera change
export function glide() {
  world.classList.add('glide');
  viewport.classList.add('glide');
  clearTimeout(glide.timer);
  glide.timer = setTimeout(() => {
    world.classList.remove('glide');
    viewport.classList.remove('glide');
  }, 500);
}

// move (and zoom out if needed) so every card is on screen
export function centerView() {
  const b = board();
  if (!b.cards.length) {
    b.pan = { x: 0, y: 0 };
    b.zoom = 1;
  } else {
    const minX = Math.min(...b.cards.map(c => c.x));
    const minY = Math.min(...b.cards.map(c => c.y));
    const maxX = Math.max(...b.cards.map(c => c.x + c.w));
    const maxY = Math.max(...b.cards.map(c => c.y + c.h));
    const top = 110, margin = 60;
    const fit = Math.min((innerWidth - margin * 2) / (maxX - minX), (innerHeight - top - margin) / (maxY - minY));
    b.zoom = clampZoom(Math.min(1, fit));
    b.pan = {
      x: Math.round(innerWidth / 2 - ((minX + maxX) / 2) * b.zoom),
      y: Math.round(top + (innerHeight - top) / 2 - ((minY + maxY) / 2) * b.zoom),
    };
  }
  glide();
  applyView();
  save();
}
