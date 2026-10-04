// Backups that survive removing the extension: a plain file in your Downloads folder.
// Chrome erases the extension's own storage when it's removed, so a copy outside the
// browser is the only thing that can bring the boards back.
//
// Written to Downloads/board-autobackup.json (same name every time, so it's overwritten).
// On a fresh install the file is held back until you restore or choose "start fresh",
// otherwise an empty board could overwrite the good backup.

import { $, h } from './dom.js';
import { store, hasChrome, onSave, readKey, writeKey, writeNow, save } from './state.js';
import { toast } from './ui.js';

export const BACKUP_FILE = 'board-autobackup.json';
const META_KEY = 'board-backup-meta';
const QUIET = 30e3;        // wait for editing to settle
const MIN_GAP = 3 * 3600e3; // Chrome shows a download bubble each time, so don't be chatty

let timer = null;
let meta = {}; // { at, error }

export const canBackupToDisk = () => hasChrome && !!chrome.downloads;

export function backupJson() {
  return JSON.stringify({ app: 'board', version: 2, state: store.state, images: store.images });
}

export const ASK_WHERE = "Chrome is set to ask where to save every download. Turn that off in chrome://settings/downloads so backups can run by themselves.";

// interactive: the person clicked "Back up now", so give them time to answer a Save dialog if Chrome shows one.
export async function backupNow({ interactive = false } = {}) {
  if (store.state.settings.backupHold) return false; // would overwrite the backup we're waiting to restore
  clearTimeout(timer);
  timer = null;
  try {
    const url = URL.createObjectURL(new Blob([backupJson()], { type: 'application/json' }));
    const id = await chrome.downloads.download({ url, filename: BACKUP_FILE, conflictAction: 'overwrite', saveAs: false });
    // a download can resolve and still go nowhere, so watch how it ends. With "ask where to save"
    // on, Chrome parks it with no filename behind a Save dialog; an automatic run shouldn't leave that open.
    const patience = interactive ? 60e3 : 20e3; // the first download after Chrome starts can take ~5s
    const t0 = Date.now();
    let item;
    for (;;) {
      [item] = await chrome.downloads.search({ id });
      if (item?.state !== 'in_progress') break;
      if (!item.filename && Date.now() - t0 > patience) {
        await chrome.downloads.cancel(id);
        await chrome.downloads.erase({ id });
        item = { state: 'asking' };
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    URL.revokeObjectURL(url);
    if (item?.state === 'complete') meta = { at: Date.now() };
    else meta = { at: meta.at, error: item?.state === 'asking' ? 'asking' : item?.error || 'did not finish' };
  } catch (err) {
    meta = { at: meta.at, error: err.message };
  }
  writeKey(META_KEY, meta);
  return !meta.error;
}

function schedule() {
  if (!canBackupToDisk() || store.state.settings.backupHold || meta.error === 'asking') return;
  clearTimeout(timer);
  const wait = Math.max(QUIET, (meta.at || 0) + MIN_GAP - Date.now());
  timer = setTimeout(backupNow, wait);
}

export function backupNote() {
  if (!canBackupToDisk()) return 'Backups to Downloads work once this is loaded as an extension.';
  if (store.state.settings.backupHold) return 'Paused until you restore a backup or start fresh.';
  if (meta.error === 'asking') return ASK_WHERE;
  if (meta.error) return `Last backup failed (${meta.error}).`;
  if (!meta.at) return `Saved to Downloads/${BACKUP_FILE} automatically.`;
  const when = new Date(meta.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `Last saved ${when} to Downloads/${BACKUP_FILE}.`;
}

// lets the user point at the backup file; opens in Downloads where the file lives
export async function chooseBackupFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await showOpenFilePicker({
        startIn: 'downloads',
        types: [{ description: 'Board backup', accept: { 'application/json': ['.json'] } }],
      });
      return await handle.getFile();
    } catch {
      return null; // cancelled
    }
  }
  $('#import').click(); // older Chrome: fall back to the normal file input
  return null;
}

export function releaseHold() {
  delete store.state.settings.backupHold;
  $('#restore-banner').classList.remove('show');
  save();
}

// Shown on a fresh install, when there's nothing saved yet.
export function showRestoreBanner(restoreFile) {
  const el = $('#restore-banner');
  const close = () => el.classList.remove('show');
  const restore = async () => {
    const file = await chooseBackupFile();
    if (file && (await restoreFile(file))) close();
  };
  el.replaceChildren(
    h('span', {}, 'Had boards before? Bring them back from your backup.'),
    h('button', { class: 'toast-action', onclick: restore }, 'Restore backup'),
    h('button', { class: 'banner-dismiss', onclick: () => { releaseHold(); close(); toast('Fresh start. Backups are on.'); } }, 'Start fresh'),
  );
  el.classList.add('show');
}

export async function initAutoBackup({ fresh, restoreFile }) {
  meta = (await readKey(META_KEY)) || {};
  if (fresh) {
    store.state.settings.backupHold = true;
    writeNow(); // remember it across reloads, or the next open would back up the empty board
  }
  onSave(schedule);
  if (store.state.settings.backupHold) {
    if (canBackupToDisk()) showRestoreBanner(restoreFile);
    return;
  }
  // first run after updating, or the backup file has gone missing for a day
  if (canBackupToDisk() && (!meta.at || Date.now() - meta.at > 24 * 3600e3)) schedule();
}
