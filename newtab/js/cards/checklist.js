import { h, uid } from '../dom.js';
import { icon } from '../icons.js';

const newItem = () => ({ id: uid(), text: '', done: false });

export default {
  label: 'Checklist',
  size: [260, 230],
  titlePlaceholder: 'To do',
  focus: '.check-text',
  defaults: () => ({ items: [newItem()] }),
  text: card => (card.items || []).map(i => i.text).join(' '),

  build(card, { save }) {
    card.items ||= [];
    const bar = h('span');
    const progress = h('div', { class: 'check-progress' }, bar);
    const list = h('ul', { class: 'check-list' });

    const updateProgress = () => {
      const done = card.items.filter(i => i.done).length;
      bar.style.width = card.items.length ? (done / card.items.length) * 100 + '%' : '0';
      progress.title = `${done} of ${card.items.length} done`;
    };
    const focusRow = i => list.children[i]?.querySelector('.check-text')?.focus();
    const redraw = () => {
      list.replaceChildren(...card.items.map(row));
      updateProgress();
    };
    const addItem = (at = card.items.length) => {
      card.items.splice(at, 0, newItem());
      redraw();
      focusRow(at);
      save();
    };
    const removeItem = item => {
      card.items = card.items.filter(i => i !== item);
      redraw();
      save();
    };

    function row(item) {
      const li = h('li', { class: item.done ? 'done' : '' });
      li.append(
        h('input', {
          type: 'checkbox',
          checked: item.done,
          onchange: e => {
            item.done = e.target.checked;
            li.classList.toggle('done', item.done);
            updateProgress();
            save();
          },
        }),
        h('input', {
          class: 'check-text',
          value: item.text,
          placeholder: 'Something to do…',
          oninput: e => { item.text = e.target.value; save(); },
          onkeydown: e => {
            const i = card.items.indexOf(item);
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem(i + 1);
            } else if (e.key === 'Backspace' && !item.text && card.items.length > 1) {
              e.preventDefault();
              removeItem(item);
              focusRow(Math.max(0, i - 1));
            } else if (e.key === 'ArrowUp') {
              focusRow(i - 1);
            } else if (e.key === 'ArrowDown') {
              focusRow(i + 1);
            }
          },
        }),
        h('button', { class: 'check-del', title: 'Remove', html: icon('x', 12), onclick: () => removeItem(item) }),
      );
      return li;
    }

    redraw();
    return h('div', { class: 'check' },
      progress,
      list,
      h('button', { class: 'check-add', onclick: () => addItem() }, '+ Add item'));
  },
};
