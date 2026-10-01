// Cards placed on the board for new users (and on request from the ⋯ menu).

import { store, board } from './state.js';
import { uid } from './dom.js';
import { embedSize } from './cards/embed.js';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

// Your Product Hunt badge, placed on the board once.
export const PRODUCT_HUNT_BADGE = {
  href: 'https://www.producthunt.com/products/buy-me-tokens?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-buy-me-tokens',
  img: 'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1266178&theme=light&t=1790846650027',
  alt: 'Buy me Tokens - Build cool stuff. Get supported for it. | Product Hunt',
  imgW: 250,
  imgH: 54,
};

const base = () => ({ id: uid(), z: 1, pinned: false, remindAt: null, title: '' });

function badgeCard(x, y) {
  const [w, h] = embedSize(PRODUCT_HUNT_BADGE);
  return { ...base(), type: 'embed', ...PRODUCT_HUNT_BADGE, color: '#ff6b6b', x: Math.round(x - w / 2), y: Math.round(y), w, h };
}

// Adds the welcome cards around `at` (board coordinates).
export function seedWelcome(at, { withBadge = false } = {}) {
  const b = board();
  const x = Math.round(at.x), y = Math.round(at.y);
  const note = {
    ...base(), type: 'note', color: '#ffc857',
    title: 'Welcome to your Board 👋',
    body: 'This is your own world on every new tab.\n\nEverything saves by itself. Delete these cards whenever you like — or keep them as a cheat sheet.',
    x: x - 340, y: y - 170, w: 290, h: 200,
  };
  const items = [
    'Double-click empty space to add a card',
    'Drag a card by its top bar',
    'Hover a card: connect, remind, pin',
    'Shift-drag on empty space to select several',
    `${MOD}Z undoes anything`,
    'Paste a link or image onto the board',
    'Press C to see everything',
  ];
  const checklist = {
    ...base(), type: 'checklist', color: '#4ecdc4',
    title: 'Try these',
    items: items.map(text => ({ id: uid(), text, done: false })),
    x: x + 20, y: y - 190, w: 320, h: 300,
  };
  const link = {
    ...base(), type: 'link', color: '#7c83fd',
    title: 'Board on GitHub', url: 'https://github.com/thejamesnick/board',
    x: x - 340, y: y + 60, w: 290, h: 124,
  };
  b.cards.push(note, checklist, link);
  b.links.push({ id: uid(), a: note.id, b: checklist.id });
  if (withBadge && !b.cards.some(c => c.img === PRODUCT_HUNT_BADGE.img)) b.cards.push(badgeCard(x + 180, y + 150));
  return [note, checklist, link];
}

// Existing users get the badge once, without the welcome cards.
export function seedBadgeOnce(at) {
  const s = store.state;
  if (s.settings.seededBadge) return false;
  s.settings.seededBadge = true;
  const b = board();
  if (!b.cards.some(c => c.img === PRODUCT_HUNT_BADGE.img)) b.cards.push(badgeCard(at.x, at.y + 140));
  return true;
}
