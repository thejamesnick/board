// Badge / embed card: paste embed code (e.g. a Product Hunt badge) or an image link.
// The code is parsed, never injected — we only keep the link and image URLs.

import { h } from '../dom.js';

const isHttp = url => /^https?:\/\//i.test(url || '');

export function parseEmbed(code) {
  const text = (code || '').trim();
  if (/^https?:\/\/\S+$/i.test(text)) return { img: text, href: '', alt: '' };
  const doc = new DOMParser().parseFromString(text, 'text/html'); // inert: nothing loads or runs
  const img = doc.querySelector('img');
  if (!img || !isHttp(img.getAttribute('src'))) return null;
  const href = img.closest('a')?.getAttribute('href');
  return {
    img: img.getAttribute('src'),
    href: isHttp(href) ? href : '',
    alt: img.getAttribute('alt') || '',
    imgW: Number(img.getAttribute('width')) || 0,
    imgH: Number(img.getAttribute('height')) || 0,
  };
}

// card size that fits the badge snugly
export function embedSize({ imgW, imgH }) {
  return imgW && imgH ? [imgW + 24, imgH + 48] : [280, 120];
}

export default {
  label: 'Embed / badge',
  size: [300, 150],
  hasTitle: false,
  focus: '.embed-input',
  defaults: () => ({ img: '', href: '', alt: '' }),
  text: card => [card.alt, card.href].filter(Boolean).join(' '),

  build(card, { save, rerender, el }) {
    if (!card.img) {
      const input = h('textarea', {
        class: 'embed-input',
        placeholder: 'Paste embed code (like a Product Hunt badge) or an image link',
      });
      const add = () => {
        const parsed = parseEmbed(input.value);
        if (!parsed) {
          input.classList.add('shake');
          setTimeout(() => input.classList.remove('shake'), 400);
          return;
        }
        Object.assign(card, parsed);
        [card.w, card.h] = embedSize(parsed);
        el.style.width = card.w + 'px';
        el.style.height = card.h + 'px';
        rerender();
        save();
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
      });
      return h('div', { class: 'embed-edit' }, input, h('button', { class: 'btn primary small', onclick: add }, 'Add'));
    }

    const img = h('img', { class: 'embed-img', src: card.img, alt: card.alt, draggable: false });
    return card.href
      ? h('a', { class: 'embed', href: card.href, target: '_blank', rel: 'noopener noreferrer', draggable: false }, img)
      : h('div', { class: 'embed' }, img);
  },
};
