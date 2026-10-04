// Entry point: load saved state, draw the board, wire everything up.

import { store, migrate, readKey, onWrite, writeNow, STATE_KEY, IMAGES_KEY } from './state.js';
import { viewCenter } from './view.js';
import { renderBoard, cardEls, focusCard } from './board.js';
import { initClock } from './clock.js';
import { initInput } from './input.js';
import { initMenus, importBackup } from './menus.js';
import { initAutoBackup } from './autobackup.js';
import { initSearch } from './search.js';
import { initSync } from './sync.js';
import { initHistory } from './history.js';
import { syncAlarms } from './reminders.js';
import { gcImages } from './images.js';
import { dailySnapshot } from './snapshots.js';
import { seedWelcome, seedBadgeOnce, moveBadgeToScreen } from './welcome.js';

async function boot() {
  const saved = await readKey(STATE_KEY);
  store.state = migrate(saved);
  store.images = (await readKey(IMAGES_KEY)) || {};

  // first run gets the welcome cards; everyone gets the Product Hunt badge once.
  // writeNow (not save) so a newer synced copy from another computer still wins.
  if (!saved) {
    seedWelcome(viewCenter(), { withBadge: true });
    Object.assign(store.state.settings, { seededBadge: true, badgeOnScreen: true });
    writeNow();
  } else {
    const seeded = seedBadgeOnce(viewCenter());
    const moved = moveBadgeToScreen();
    if (seeded || moved) writeNow();
  }

  renderBoard();
  initClock(() => cardEls.forEach(el => el.tick?.()));
  initInput();
  initMenus();
  initSearch();
  onWrite(syncAlarms);
  await initSync();
  initAutoBackup({ fresh: !saved, restoreFile: importBackup });
  initHistory();
  syncAlarms();
  dailySnapshot().then(gcImages);

  // opened from a reminder notification: jump to that card
  const focusId = new URLSearchParams(location.search).get('focus');
  if (focusId) {
    history.replaceState(null, '', location.pathname);
    requestAnimationFrame(() => focusCard(focusId));
  }
}

boot();
