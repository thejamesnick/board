// Lines connecting cards, like strings on a detective board.

import { board, save } from './state.js';
import { svgEl } from './dom.js';
import { openMenu, toast, hideToast } from './ui.js';
import { viewport, linksSvg, toWorld } from './view.js';
import { cardEls } from './board.js';

let connecting = null; // card we're drawing a line from
let pointer = null;    // board position of the mouse while connecting

export const isConnecting = () => !!connecting;

const center = c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

function curve(a, b) {
  const dir = b.x >= a.x ? 1 : -1;
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2) * dir;
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

export function drawLinks() {
  const b = board();
  linksSvg.replaceChildren();
  for (const link of b.links) {
    const from = b.cards.find(c => c.id === link.a);
    const to = b.cards.find(c => c.id === link.b);
    if (!from || !to) continue;
    const d = curve(center(from), center(to));
    const g = svgEl('g', { class: 'link' });
    g.append(
      svgEl('path', { d, class: 'link-line', stroke: from.color }),
      svgEl('path', { d, class: 'link-hit' }),
    );
    g.addEventListener('click', e => openMenu({ x: e.clientX, y: e.clientY }, [{
      label: 'Remove connection',
      danger: true,
      action: () => {
        b.links = b.links.filter(l => l !== link);
        drawLinks();
        save();
      },
    }]));
    linksSvg.append(g);
  }
  if (connecting && pointer) {
    linksSvg.append(svgEl('path', { d: curve(center(connecting), pointer), class: 'link-line temp', stroke: connecting.color }));
  }
}

export function startConnect(card) {
  cancelConnect();
  connecting = card;
  pointer = null;
  viewport.classList.add('connecting');
  cardEls.get(card.id)?.classList.add('connect-source');
  toast('Click another card to connect them · Esc to cancel', { ms: 60000 });
}

export function finishConnect(target) {
  const from = connecting;
  cancelConnect();
  if (!from || target.id === from.id) return;
  const b = board();
  const exists = b.links.some(l => (l.a === from.id && l.b === target.id) || (l.a === target.id && l.b === from.id));
  if (exists) return toast('Those cards are already connected');
  b.links.push({ id: crypto.randomUUID(), a: from.id, b: target.id });
  drawLinks();
  save();
}

export function cancelConnect() {
  if (!connecting) return;
  cardEls.get(connecting.id)?.classList.remove('connect-source');
  connecting = null;
  pointer = null;
  viewport.classList.remove('connecting');
  hideToast();
  drawLinks();
}

viewport.addEventListener('pointermove', e => {
  if (!connecting) return;
  pointer = toWorld(e.clientX, e.clientY);
  drawLinks();
});
