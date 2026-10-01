// Registry of card types. Each type module exports:
//   label, size [w, h], defaults() -> fields, build(card, ctx) -> element,
//   text(card) -> searchable text, and optionally titlePlaceholder, hasTitle, focus.
// ctx = { el, save, rerender }

import note from './note.js';
import checklist from './checklist.js';
import link from './link.js';
import image from './image.js';
import countdown from './countdown.js';
import embed from './embed.js';

export const CARD_TYPES = { note, checklist, link, image, countdown, embed };

export const cardText = card => [card.title, (CARD_TYPES[card.type] || note).text(card)].filter(Boolean).join(' ');
