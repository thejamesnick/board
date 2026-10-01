// Image helpers: shrink big photos before storing, pick files, clean up unused images.

import { $ } from './dom.js';
import { store, saveImages } from './state.js';

const readAsDataURL = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export async function compressImage(file, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  // keep small GIFs as-is so they stay animated
  if (file.type === 'image/gif' && file.size < 3e6) return { url: await readAsDataURL(file), width, height };
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return { url: canvas.toDataURL('image/webp', 0.85), width, height };
}

export function pickImage(onFile) {
  const picker = $('#image-picker');
  picker.onchange = () => {
    const file = picker.files[0];
    picker.value = '';
    if (file) onFile(file);
  };
  picker.click();
}

// drop images no card or wallpaper uses anymore
export function gcImages() {
  const used = new Set();
  for (const b of store.state.boards) {
    if (b.bgImage) used.add(b.bgImage);
    for (const c of b.cards) if (c.imageId) used.add(c.imageId);
  }
  let removed = false;
  for (const id of Object.keys(store.images)) {
    if (!used.has(id)) {
      delete store.images[id];
      removed = true;
    }
  }
  if (removed) saveImages();
}
