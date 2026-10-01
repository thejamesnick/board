import { h } from '../dom.js';
import { icon } from '../icons.js';

const editing = new Set(); // card ids currently showing the URL input

export function normalizeUrl(raw) {
  let text = raw.trim();
  if (!text) return null;
  if (!/^[a-z]+:\/\//i.test(text)) text = 'https://' + text;
  try {
    const url = new URL(text);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

function faviconUrl(url) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`);
  }
  return `https://www.google.com/s2/favicons?sz=64&domain=${new URL(url).hostname}`;
}

const hostOf = url => new URL(url).hostname.replace(/^www\./, '');

export default {
  label: 'Link',
  size: [260, 124],
  titlePlaceholder: 'Name',
  focus: '.link-input',
  defaults: () => ({ url: '' }),
  text: card => card.url || '',

  build(card, { save, rerender, el }) {
    if (!card.url || editing.has(card.id)) {
      const commit = value => {
        const url = normalizeUrl(value);
        if (!url) return;
        if (url === card.url && !editing.has(card.id)) return;
        card.url = url;
        if (!card.title) card.title = hostOf(url);
        editing.delete(card.id);
        rerender();
        save();
      };
      return h('input', {
        class: 'link-input',
        placeholder: 'Paste a link, press Enter',
        value: card.url || '',
        onkeydown: e => {
          if (e.key === 'Enter') commit(e.target.value);
          if (e.key === 'Escape' && card.url) { editing.delete(card.id); rerender(); }
        },
        onblur: e => commit(e.target.value),
      });
    }

    const url = new URL(card.url);
    const path = url.pathname === '/' ? '' : decodeURI(url.pathname) + url.search;
    return h('a', { class: 'link-tile', href: card.url, draggable: false },
      h('img', { class: 'favicon', src: faviconUrl(card.url), alt: '', draggable: false }),
      h('span', { class: 'link-meta' },
        h('span', { class: 'link-host' }, hostOf(card.url)),
        path ? h('span', { class: 'link-path' }, path) : null),
      h('button', {
        class: 'link-editbtn',
        title: 'Change link',
        html: icon('edit', 12),
        onclick: e => {
          e.preventDefault();
          e.stopPropagation();
          editing.add(card.id);
          rerender();
          document.querySelector(`[data-id="${card.id}"] .link-input`)?.focus();
        },
      }));
  },
};
