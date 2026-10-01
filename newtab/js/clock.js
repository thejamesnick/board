// Clock with rolling digits and a greeting.

import { $, pad } from './dom.js';

// Put each character of `text` in its own slot; characters that changed roll in.
function setSlots(container, text) {
  while (container.children.length > text.length) container.lastChild.remove();
  while (container.children.length < text.length) {
    const slot = document.createElement('span');
    slot.className = 'slot';
    slot.appendChild(document.createElement('span'));
    container.appendChild(slot);
  }
  [...text].forEach((ch, i) => {
    const slot = container.children[i];
    slot.classList.toggle('colon', ch === ':');
    const current = slot.lastElementChild;
    if (current.textContent === ch) return;
    if (current.textContent === '') { current.textContent = ch; return; } // first paint: no roll
    slot.querySelectorAll('.out').forEach(o => o.remove());
    current.className = 'out';
    current.addEventListener('animationend', () => current.remove(), { once: true });
    const next = document.createElement('span');
    next.className = 'in';
    next.textContent = ch;
    slot.appendChild(next);
  });
}

function tick() {
  const now = new Date();
  const h = now.getHours();
  setSlots($('#clock-hm'), `${h % 12 || 12}:${pad(now.getMinutes())}`);
  setSlots($('#clock-s'), pad(now.getSeconds()));
  $('#clock-ap').textContent = h < 12 ? 'AM' : 'PM';
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent =
    `${part} · ${now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`;
}

// onTick runs every second too (countdown cards use it)
export function initClock(onTick) {
  const run = () => { tick(); onTick?.(); };
  run();
  // fire right on each new second so the seconds never skip
  const schedule = () => setTimeout(() => { run(); schedule(); }, 1000 - (Date.now() % 1000));
  schedule();
}
