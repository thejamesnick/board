// Snapping while dragging: line up with other cards' edges and centers (with guide
// lines), otherwise snap to a light grid. Hold Alt/Option to drag freely.

import { world } from './view.js';
import { h } from './dom.js';

const GRID = 14;
const THRESHOLD = 6; // screen pixels

// r = { x, y, w, h } where the card would go; returns the snapped spot + guides to draw
export function snapPosition(r, others, zoom) {
  const reach = THRESHOLD / zoom;
  const best = { x: null, y: null };

  for (const o of others) {
    for (const k of [0, r.w / 2, r.w]) {
      for (const target of [o.x, o.x + o.w / 2, o.x + o.w]) {
        const d = Math.abs(r.x + k - target);
        if (d <= reach && (!best.x || d < best.x.d)) best.x = { d, pos: target - k, line: target, o };
      }
    }
    for (const k of [0, r.h / 2, r.h]) {
      for (const target of [o.y, o.y + o.h / 2, o.y + o.h]) {
        const d = Math.abs(r.y + k - target);
        if (d <= reach && (!best.y || d < best.y.d)) best.y = { d, pos: target - k, line: target, o };
      }
    }
  }

  const x = best.x ? best.x.pos : Math.round(r.x / GRID) * GRID;
  const y = best.y ? best.y.pos : Math.round(r.y / GRID) * GRID;
  const guides = [];
  if (best.x) {
    const o = best.x.o;
    guides.push({ v: true, at: best.x.line, from: Math.min(y, o.y) - 12, to: Math.max(y + r.h, o.y + o.h) + 12 });
  }
  if (best.y) {
    const o = best.y.o;
    guides.push({ v: false, at: best.y.line, from: Math.min(x, o.x) - 12, to: Math.max(x + r.w, o.x + o.w) + 12 });
  }
  return { x: Math.round(x), y: Math.round(y), guides };
}

export function showGuides(guides, zoom) {
  let layer = world.querySelector('.guides');
  if (!layer) {
    layer = h('div', { class: 'guides' });
    world.append(layer);
  }
  const thick = Math.max(1, 1 / zoom) + 'px';
  layer.replaceChildren(...guides.map(g => h('div', {
    class: 'guide',
    style: g.v
      ? { left: g.at + 'px', top: g.from + 'px', height: g.to - g.from + 'px', width: thick }
      : { top: g.at + 'px', left: g.from + 'px', width: g.to - g.from + 'px', height: thick },
  })));
}

export function hideGuides() {
  world.querySelector('.guides')?.remove();
}
