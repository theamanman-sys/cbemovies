const SUBTITLE_DB = 'SubtitleCache';
const SUBTITLE_STORE = 'subtitles';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SUBTITLE_DB, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SUBTITLE_STORE)) {
        const store = db.createObjectStore(SUBTITLE_STORE, { keyPath: 'id' });
        store.createIndex('imdb', 'imdb', { unique: false });
        store.createIndex('lang', 'lang', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function storeKey(imdb, lang) { return `${imdb}_${lang}`; }

async function saveSubtitle(imdb, lang, vtt, label) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBTITLE_STORE, 'readwrite');
    tx.objectStore(SUBTITLE_STORE).put({
      id: storeKey(imdb, lang),
      imdb,
      lang,
      vtt,
      label: label || lang.toUpperCase(),
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getSubtitle(imdb, lang) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBTITLE_STORE, 'readonly');
    const req = tx.objectStore(SUBTITLE_STORE).get(storeKey(imdb, lang));
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getSubtitlesByImdb(imdb) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBTITLE_STORE, 'readonly');
    const index = tx.objectStore(SUBTITLE_STORE).index('imdb');
    const req = index.getAll(imdb);
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function listAllSubtitles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBTITLE_STORE, 'readonly');
    const req = tx.objectStore(SUBTITLE_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteSubtitle(imdb, lang) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBTITLE_STORE, 'readwrite');
    tx.objectStore(SUBTITLE_STORE).delete(storeKey(imdb, lang));
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}
