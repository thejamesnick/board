// Keeping boards in step: across open tabs (chrome.storage.local) and across
// computers (chrome.storage.sync, which follows your Chrome account).
// Only text syncs; images and wallpapers stay on the computer they were added on.
// chrome.storage.sync allows ~8 KB per item, so the boards are split into chunks.

import { store, hasChrome, migrate, onSave, writeNow, save, hasPendingSave, STATE_KEY, IMAGES_KEY, readKey } from './state.js';
import { isTyping } from './dom.js';
import { renderBoard } from './board.js';

const CHUNK = 2000;
const META = 'sync-meta';

let pushTimer = null;
let status = { kind: 'idle' };

export const canSync = () => hasChrome && !!chrome.storage.sync;
const syncOn = () => canSync() && store.state.settings.sync;

function schedulePush() {
  if (!syncOn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSync, 4000); // Chrome limits sync writes, so batch them
}

async function pushSync() {
  clearTimeout(pushTimer);
  pushTimer = null;
  const json = JSON.stringify({ boards: store.state.boards, updatedAt: store.state.updatedAt });
  const n = Math.ceil(json.length / CHUNK);
  const items = { [META]: { n, updatedAt: store.state.updatedAt } };
  for (let i = 0; i < n; i++) items['sync-' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
  try {
    const old = (await chrome.storage.sync.get(META))[META];
    await chrome.storage.sync.set(items);
    if (old?.n > n) {
      await chrome.storage.sync.remove(Array.from({ length: old.n - n }, (_, i) => 'sync-' + (n + i)));
    }
    status = { kind: 'ok', at: Date.now() };
  } catch (err) {
    status = {
      kind: 'error',
      msg: /quota/i.test(err.message) ? 'Too much text to sync (Chrome allows about 100 KB)' : err.message,
    };
  }
}

async function pullSync() {
  const meta = (await chrome.storage.sync.get(META))[META];
  if (!meta?.n) return null;
  const keys = Array.from({ length: meta.n }, (_, i) => 'sync-' + i);
  const got = await chrome.storage.sync.get(keys);
  try {
    return JSON.parse(keys.map(k => got[k] ?? '').join(''));
  } catch {
    return null; // caught mid-write; the next change event will retry
  }
}

// take someone else's copy if it's newer than ours
function adopt(boards, updatedAt) {
  const keepActive = store.state.activeBoard;
  const next = migrate({ ...store.state, boards, activeBoard: keepActive });
  store.state.boards = next.boards;
  store.state.activeBoard = next.activeBoard;
  store.state.updatedAt = updatedAt;
  writeNow();
  renderBoard();
}

const busy = () => hasPendingSave() || (isTyping(document.activeElement) && document.activeElement.name !== 'q');

export async function initSync() {
  onSave(schedulePush);
  window.addEventListener('pagehide', () => { if (pushTimer) pushSync(); });
  if (!hasChrome) return;

  if (syncOn()) {
    const remote = await pullSync();
    if (remote?.boards?.length && remote.updatedAt > store.state.updatedAt) {
      adopt(remote.boards, remote.updatedAt);
      status = { kind: 'ok', at: Date.now() };
    } else {
      schedulePush();
    }
  }

  chrome.storage.onChanged.addListener(async (changes, area) => {
    // another tab on this computer saved
    if (area === 'local' && changes[STATE_KEY]?.newValue) {
      const nv = changes[STATE_KEY].newValue;
      if (nv.updatedAt > store.state.updatedAt && !busy()) adopt(nv.boards, nv.updatedAt);
    }
    if (area === 'local' && changes[IMAGES_KEY]) {
      store.images = changes[IMAGES_KEY].newValue || {};
    }
    // another computer synced
    if (area === 'sync' && changes[META]?.newValue && syncOn()) {
      if (changes[META].newValue.updatedAt > store.state.updatedAt && !busy()) {
        const remote = await pullSync();
        if (remote?.boards?.length && remote.updatedAt > store.state.updatedAt) {
          adopt(remote.boards, remote.updatedAt);
          status = { kind: 'ok', at: Date.now() };
        }
      }
    }
  });

  // catch up on anything missed while this tab was in the background
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || busy()) return;
    const saved = await readKey(STATE_KEY);
    if (saved?.updatedAt > store.state.updatedAt) adopt(saved.boards, saved.updatedAt);
  });
}

export async function toggleSync() {
  store.state.settings.sync = !store.state.settings.sync;
  save();
  if (store.state.settings.sync) {
    const remote = await pullSync();
    if (remote?.boards?.length && remote.updatedAt > store.state.updatedAt) adopt(remote.boards, remote.updatedAt);
    else pushSync();
  } else {
    clearTimeout(pushTimer);
    status = { kind: 'idle' };
  }
}

export function syncNote() {
  if (!canSync()) return 'Sync works once this is loaded as an extension.';
  if (!store.state.settings.sync) return 'Off. Your boards stay on this computer.';
  if (status.kind === 'error') return status.msg;
  const when = status.at ? `Last synced ${new Date(status.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. ` : '';
  return `${when}Text syncs through your Chrome account. Images stay on this computer.`;
}
