import { h, toLocalInput } from '../dom.js';

const editing = new Set();

function parts(target) {
  const diff = new Date(target) - Date.now();
  const past = diff < 0;
  const s = Math.floor(Math.abs(diff) / 1000);
  const d = Math.floor(s / 86400), hr = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d >= 1) return { big: d, unit: d === 1 ? 'day' : 'days', sub: `${hr}h ${m}m`, past };
  if (hr >= 1) return { big: hr, unit: hr === 1 ? 'hour' : 'hours', sub: `${m}m ${sec}s`, past };
  return { big: m, unit: 'min', sub: `${sec}s`, past };
}

export default {
  label: 'Countdown',
  size: [240, 190],
  titlePlaceholder: 'Counting down to…',
  defaults: () => ({ date: '' }),
  text: () => '',

  build(card, { save, rerender, el }) {
    if (!card.date || editing.has(card.id)) {
      const input = h('input', {
        type: 'datetime-local',
        class: 'field',
        value: card.date || toLocalInput(Date.now() + 86400e3),
      });
      const set = () => {
        if (!input.value) return;
        card.date = input.value;
        editing.delete(card.id);
        rerender();
        save();
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') set(); });
      return h('div', { class: 'cd-edit' },
        input,
        h('button', { class: 'btn primary small', onclick: set }, 'Start countdown'));
    }

    const big = h('span', { class: 'cd-big' });
    const unit = h('span', { class: 'cd-unit' });
    const sub = h('div', { class: 'cd-sub' });
    const when = new Date(card.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    el.tick = () => {
      const p = parts(card.date);
      big.textContent = p.big;
      unit.textContent = p.unit + (p.past ? ' ago' : '');
      sub.textContent = p.past ? when : `${p.sub} · ${when}`;
      el.classList.toggle('cd-past', p.past);
    };
    el.tick();

    return h('button', {
      class: 'cd',
      title: 'Click to change the date',
      onclick: () => { editing.add(card.id); rerender(); },
    }, h('div', { class: 'cd-row' }, big, unit), sub);
  },
};
