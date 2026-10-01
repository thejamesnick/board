// Background worker: shows reminder notifications even when no tab is open.

const STATE_KEY = 'board-state';
const ALARM_PREFIX = 'remind|';

async function loadState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY];
}

function findCard(state, id) {
  for (const board of state?.boards || []) {
    const card = board.cards.find(c => c.id === id);
    if (card) return { board, card };
  }
  return null;
}

function summary(card) {
  switch (card.type) {
    case 'checklist': {
      const left = (card.items || []).filter(i => !i.done && i.text);
      return left.length ? `${left.length} left: ${left.map(i => i.text).join(', ')}` : 'All done!';
    }
    case 'link': return card.url || '';
    case 'countdown': return card.date ? `Counting down to ${new Date(card.date).toLocaleString()}` : '';
    case 'image': return 'Image card';
    default: return card.body || '';
  }
}

chrome.alarms.onAlarm.addListener(async alarm => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  const found = findCard(await loadState(), id);
  if (!found) return;
  const { board, card } = found;
  chrome.notifications.create('card|' + id, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: card.title || 'Reminder',
    message: summary(card).slice(0, 200) || 'From your board',
    contextMessage: board.name,
    priority: 2,
    requireInteraction: true,
  });
});

chrome.notifications.onClicked.addListener(notificationId => {
  if (!notificationId.startsWith('card|')) return;
  const id = notificationId.slice(5);
  chrome.tabs.create({ url: chrome.runtime.getURL(`newtab.html?focus=${encodeURIComponent(id)}`) });
  chrome.notifications.clear(notificationId);
});

// alarms can be lost when Chrome restarts, so rebuild them from saved state
async function restoreAlarms() {
  const state = await loadState();
  for (const board of state?.boards || []) {
    for (const card of board.cards) {
      if (card.remindAt && card.remindAt > Date.now()) {
        chrome.alarms.create(ALARM_PREFIX + card.id, { when: card.remindAt });
      }
    }
  }
}

chrome.runtime.onStartup.addListener(restoreAlarms);
chrome.runtime.onInstalled.addListener(restoreAlarms);
