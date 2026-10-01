import { h } from '../dom.js';
import { store } from '../state.js';

export default {
  label: 'Image',
  size: [280, 220],
  titlePlaceholder: 'Caption',
  focus: null,
  defaults: () => ({ imageId: null }),
  text: () => '',

  build(card) {
    const src = store.images[card.imageId];
    if (!src) return h('div', { class: 'img-missing' }, 'This image isn’t on this computer');
    return h('div', { class: 'img-wrap' },
      h('img', { class: 'card-img', src, alt: card.title || '', draggable: false }));
  },
};
