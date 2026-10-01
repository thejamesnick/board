import { h } from '../dom.js';

export default {
  label: 'Note',
  size: [240, 170],
  defaults: () => ({ body: '' }),
  text: card => card.body || '',

  build(card, { save }) {
    return h('textarea', {
      class: 'card-body',
      placeholder: 'Remember this…',
      value: card.body || '',
      oninput: e => { card.body = e.target.value; save(); },
    });
  },
};
