'use strict';
// Web replacements for SharedPreferences (OpusBirthdayActivity) and
// OpusMemoryStorageManager: localStorage for settings, IndexedDB for photos.

const Storage = {
  KEY: 'opus_birthday_prefs_v1',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch { return {}; }
  },

  save(patch) {
    try {
      const current = this.load();
      localStorage.setItem(this.KEY, JSON.stringify({ ...current, ...patch }));
    } catch { /* storage unavailable (private mode) */ }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch {}
  },
};

const MemoryDB = {
  db: null,

  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('opus_birthday', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('memories', { keyPath: 'id' });
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },

  async add(dataUrl) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const memory = { id: crypto.randomUUID(), dataUrl, ts: Date.now() };
      const tx = db.transaction('memories', 'readwrite');
      tx.objectStore('memories').put(memory);
      tx.oncomplete = () => resolve(memory);
      tx.onerror = () => reject(tx.error);
    });
  },

  async all() {
    try {
      const db = await this.open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('memories', 'readonly');
        const req = tx.objectStore('memories').getAll();
        req.onsuccess = () => resolve(req.result.sort((a, b) => b.ts - a.ts));
        req.onerror = () => reject(req.error);
      });
    } catch { return []; }
  },

  async clearAll() {
    try {
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('memories', 'readwrite');
        tx.objectStore('memories').clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
  },
};

// Downscale an image (File or ImageBitmap) to max 800px JPEG, mirroring the
// optimization done before upload in the Android app.
function imageToDataUrl(source, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = (e) => { URL.revokeObjectURL(img.src); reject(e); };
    img.src = URL.createObjectURL(source);
  });
}
