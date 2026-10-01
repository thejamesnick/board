// Reminders: a time on any card. Chrome alarms wake background.js, which shows a notification.

import { store, save } from './state.js';
import { h, toLocalInput, fmtWhen } from './dom.js';
import { icon } from './icons.js';
import { showFloating, closeFloating, toast } from './ui.js';
import { mountCard } from './board.js';

const ALARM_PREFIX = 'remind|';
const hasAlarms = () => typeof chrome !== 'undefined' && !!chrome.alarms;

export function reminderChip(card) {
  if (!card.remindAt) return null;
  const past = card.remindAt < Date.now();
  return h('button', {
    class: 'remind-chip' + (past ? ' past' : ''),
    title: past ? 'Reminder went off' : 'Reminder',
    html: icon('bell', 12),
    onclick: e => openReminder(card, e.currentTarget),
  }, fmtWhen(card.remindAt));
}

function at(hour, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export function openReminder(card, anchor) {
  const set = when => {
    card.remindAt = when;
    mountCard(card);
    save();
    closeFloating();
    if (when) toast(`I'll remind you ${fmtWhen(when)}`);
  };
  const input = h('input', {
    type: 'datetime-local',
    class: 'field',
    value: toLocalInput(card.remindAt && card.remindAt > Date.now() ? card.remindAt : Date.now() + 3600e3),
  });
  const now = new Date();
  const pop = h('div', { class: 'popover' },
    h('div', { class: 'pop-title' }, 'Remind me'),
    h('div', { class: 'quick' },
      h('button', { class: 'chip', onclick: () => set(Date.now() + 3600e3) }, 'In 1 hour'),
      now.getHours() < 18 ? h('button', { class: 'chip', onclick: () => set(at(19)) }, 'This evening') : null,
      h('button', { class: 'chip', onclick: () => set(at(9, 1)) }, 'Tomorrow 9am')),
    input,
    h('div', { class: 'pop-actions' },
      card.remindAt ? h('button', { class: 'btn', onclick: () => set(null) }, 'Remove') : null,
      h('button', {
        class: 'btn primary',
        onclick: () => {
          const t = new Date(input.value).getTime();
          if (!t || t <= Date.now()) return toast('Pick a time in the future');
          set(t);
        },
      }, 'Set')),
    hasAlarms() ? null : h('div', { class: 'menu-note' }, 'Notifications only work when loaded as an extension.'));
  showFloating(pop, anchor);
}

// Make Chrome's alarms match the reminders in state (called after every save).
export async function syncAlarms() {
  if (!hasAlarms()) return;
  const want = new Map();
  for (const b of store.state.boards) {
    for (const c of b.cards) {
      if (c.remindAt && c.remindAt > Date.now()) want.set(ALARM_PREFIX + c.id, c.remindAt);
    }
  }
  const existing = (await chrome.alarms.getAll()).filter(a => a.name.startsWith(ALARM_PREFIX));
  for (const a of existing) if (!want.has(a.name)) chrome.alarms.clear(a.name);
  for (const [name, when] of want) {
    const a = existing.find(x => x.name === name);
    if (!a || Math.abs(a.scheduledTime - when) > 1000) chrome.alarms.create(name, { when });
  }
}
