// Small DOM helpers shared by every module.

export const $ = sel => document.querySelector(sel);

export const uid = () => crypto.randomUUID();

export const pad = n => String(n).padStart(2, '0');

// h('div', { class: 'x', onclick: fn }, child, 'text') — tiny element builder.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v; // only ever used with our own icon strings
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k.includes('-') || !(k in el)) el.setAttribute(k, v);
    else el[k] = v;
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Date -> value for <input type="datetime-local">
export function toLocalInput(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtWhen(ts) {
  const d = new Date(ts);
  const soon = Math.abs(ts - Date.now()) < 6 * 86400e3;
  return d.toLocaleString([], soon
    ? { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export const isTyping = el => !!el?.matches?.('input, textarea');
