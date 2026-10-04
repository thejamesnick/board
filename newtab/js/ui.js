// Floating menus, popovers and the toast.

import { $, h } from './dom.js';
import { icon } from './icons.js';

let floating = null;
let floatingAnchor = null;

export const isFloatingOpen = () => !!floating;

// anchor: an element (opens below it) or a { x, y } screen point
export function showFloating(node, anchor) {
  closeFloating();
  node.classList.add('floating');
  document.body.appendChild(node);
  const r = anchor instanceof Element
    ? anchor.getBoundingClientRect()
    : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const w = node.offsetWidth, ht = node.offsetHeight;
  let x = anchor instanceof Element && r.left + w > innerWidth - 12 ? r.right - w : r.left;
  let y = r.bottom + 6;
  if (y + ht > innerHeight - 12) y = r.top - ht - 6;
  node.style.left = Math.max(12, Math.min(x, innerWidth - w - 12)) + 'px';
  node.style.top = Math.max(12, y) + 'px';
  floating = node;
  floatingAnchor = anchor instanceof Element ? anchor : null;
}

export function closeFloating() {
  floating?.remove();
  floating = null;
  floatingAnchor = null;
}

document.addEventListener('pointerdown', e => {
  if (!floating || floating.contains(e.target)) return;
  if (floatingAnchor?.contains(e.target)) return; // the anchor's own click toggles it
  closeFloating();
}, true);

// items: { label, action, checked?, danger?, hint? } | { heading } | { note } | '-'
export function openMenu(anchor, items) {
  if (floating && anchor instanceof Element && floatingAnchor === anchor) return closeFloating();
  const menu = h('div', { class: 'menu', role: 'menu' }, items.filter(Boolean).map(it => {
    if (it === '-') return h('div', { class: 'menu-sep' });
    if (it.heading) return h('div', { class: 'menu-heading' }, it.heading);
    if (it.note) return h('div', { class: 'menu-note' }, it.note);
    return h('button', {
      class: 'menu-item' + (it.danger ? ' danger' : ''),
      role: 'menuitem',
      onclick: () => { closeFloating(); it.action(); },
    },
      h('span', { class: 'menu-check', html: it.checked ? icon('check', 14) : '' }),
      h('span', { class: 'menu-label' }, it.label),
      it.hint ? h('kbd', {}, it.hint) : null);
  }));
  showFloating(menu, anchor);
}

// ---------- toast ----------

let toastTimer = null;
let toastExpire = null;

// opts: { label, action, onExpire, ms }
export function toast(msg, opts = {}) {
  const el = $('#toast');
  finishToast();
  el.replaceChildren(h('span', {}, msg));
  if (opts.label) {
    el.append(h('button', {
      class: 'toast-action',
      onclick: () => { toastExpire = null; hideToast(); opts.action(); },
    }, opts.label));
  }
  el.classList.add('show');
  toastExpire = opts.onExpire || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, opts.ms ?? (opts.label ? 6000 : 2500));
}

function finishToast() {
  const fn = toastExpire;
  toastExpire = null;
  fn?.();
}

export function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').classList.remove('show');
  finishToast();
}
