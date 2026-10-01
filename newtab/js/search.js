// Top search bar: finds cards on any board as you type; Enter with nothing picked searches the web.

import { $, h } from './dom.js';
import { store, board } from './state.js';
import { CARD_TYPES, cardText } from './cards/index.js';
import { cardEls, focusCard } from './board.js';

const form = $('#search');
const input = $('#search input');
const results = $('#search-results');

let hits = [];
let selected = -1; // -1 = nothing, hits.length = "search the web" row

const query = () => input.value.trim().toLowerCase();

function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 60);
  const start = Math.max(0, i - 24);
  return (start ? '…' : '') + text.slice(start, i + q.length + 36).replace(/\s+/g, ' ');
}

// fade out cards on the current board that don't match
export function applySearchDim() {
  const q = query();
  for (const card of board().cards) {
    cardEls.get(card.id)?.classList.toggle('dim', !!q && !cardText(card).toLowerCase().includes(q));
  }
}

function hide() {
  results.hidden = true;
  selected = -1;
}

function render() {
  const q = query();
  const multi = store.state.boards.length > 1;
  results.replaceChildren(
    ...hits.map((hit, i) => h('button', {
      class: 'result' + (i === selected ? ' sel' : ''),
      onmousedown: e => e.preventDefault(),
      onclick: () => pick(i),
    },
      h('span', { class: 'result-dot', style: { background: hit.card.color } }),
      h('span', { class: 'result-main' },
        h('span', { class: 'result-title' }, hit.card.title || CARD_TYPES[hit.card.type]?.label || 'Card'),
        h('span', { class: 'result-snip' }, snippet(hit.text, q))),
      multi ? h('span', { class: 'result-board' }, hit.board.name) : null)),
    h('button', {
      class: 'result web' + (selected === hits.length ? ' sel' : ''),
      onmousedown: e => e.preventDefault(),
      onclick: () => form.submit(),
    }, `Search the web for “${input.value.trim()}”`),
  );
  results.hidden = false;
}

function run() {
  applySearchDim();
  const q = query();
  if (!q) return hide();
  hits = [];
  for (const b of store.state.boards) {
    for (const card of b.cards) {
      const text = cardText(card);
      if (text.toLowerCase().includes(q)) hits.push({ board: b, card, text });
    }
  }
  hits = hits.slice(0, 7);
  selected = -1;
  render();
}

function pick(i) {
  const hit = hits[i];
  input.value = '';
  hide();
  input.blur();
  applySearchDim();
  focusCard(hit.card.id);
}

export function initSearch() {
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (query()) run(); });
  input.addEventListener('blur', () => setTimeout(hide, 100));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      input.value = '';
      run();
      input.blur();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.hidden) return;
      e.preventDefault();
      const max = hits.length;
      selected = e.key === 'ArrowDown' ? Math.min(max, selected + 1) : Math.max(-1, selected - 1);
      render();
    } else if (e.key === 'Enter' && selected >= 0 && selected < hits.length) {
      e.preventDefault();
      pick(selected);
    }
  });
}
