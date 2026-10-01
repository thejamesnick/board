// Entry point: load saved state, draw the board, wire everything up.

import { store, board, migrate, readKey, onWrite, writeNow, STATE_KEY, IMAGES_KEY } from './state.js';
import { uid } from './dom.js';
import { viewCenter } from './view.js';
import { renderBoard, cardEls, focusCard } from './board.js';
import { initClock } from './clock.js';
import { initInput } from './input.js';
import { initMenus } from './menus.js';
import { initSearch } from './search.js';
import { initSync } from './sync.js';
import { syncAlarms } from './reminders.js';
import { gcImages } from './images.js';
import { embedSize } from './cards/embed.js';

// Your Product Hunt badge, placed on the board once.
const PRODUCT_HUNT_BADGE = {
  href: 'https://www.producthunt.com/products/buy-me-tokens?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-buy-me-tokens',
  img: 'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1266178&theme=light&t=1790846650027',
  alt: 'Buy me Tokens - Build cool stuff. Get supported for it. | Product Hunt',
  imgW: 250,
  imgH: 54,
};

function seedBadge() {
  const s = store.state;
  if (s.settings.seededBadge) return;
  s.settings.seededBadge = true;
  const b = board();
  if (b.cards.some(c => c.img === PRODUCT_HUNT_BADGE.img)) return;
  const [w, h] = embedSize(PRODUCT_HUNT_BADGE);
  const at = viewCenter();
  b.cards.push({
    id: uid(), type: 'embed', ...PRODUCT_HUNT_BADGE,
    x: Math.round(at.x - w / 2), y: Math.round(at.y + 140), w, h,
    z: 1, color: '#ff6b6b', pinned: false, remindAt: null, title: '',
  });
  writeNow(); // no updatedAt bump, so a newer synced copy from another computer still wins
}

async function boot() {
  store.state = migrate(await readKey(STATE_KEY));
  store.images = (await readKey(IMAGES_KEY)) || {};
  gcImages();
  seedBadge();

  renderBoard();
  initClock(() => cardEls.forEach(el => el.tick?.()));
  initInput();
  initMenus();
  initSearch();
  onWrite(syncAlarms);
  await initSync();
  syncAlarms();

  // opened from a reminder notification: jump to that card
  const focusId = new URLSearchParams(location.search).get('focus');
  if (focusId) {
    history.replaceState(null, '', location.pathname);
    requestAnimationFrame(() => focusCard(focusId));
  }
}

boot();
