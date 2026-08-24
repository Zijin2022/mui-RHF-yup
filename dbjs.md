// db.js
// 這支檔案封裝所有 IndexedDB 存取邏輯。
// 兩個 object store:
//   job  -> 只有一筆 record（id: 'current'），存這次匯入的設定與進度中繼資料
//   rows -> 每一列 CSV 資料一筆 record，包含原始欄位 + 狀態 + API 結果

const DB_NAME = 'csvImporterDB';
const DB_VERSION = 1;
const STORE_JOB = 'job';
const STORE_ROWS = 'rows';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_JOB)) {
        db.createObjectStore(STORE_JOB, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ROWS)) {
        const store = db.createObjectStore(STORE_ROWS, { keyPath: 'idx' });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_JOB, STORE_ROWS], 'readwrite');
    tx.objectStore(STORE_JOB).clear();
    tx.objectStore(STORE_ROWS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveJob(job) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB, 'readwrite');
    tx.objectStore(STORE_JOB).put({ id: 'current', ...job });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getJob() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOB, 'readonly');
    const req = tx.objectStore(STORE_JOB).get('current');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putRowsBulk(rows) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readwrite');
    const store = tx.objectStore(STORE_ROWS);
    for (const r of rows) store.put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putRow(row) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readwrite');
    tx.objectStore(STORE_ROWS).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countByStatus(status) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readonly');
    const idx = tx.objectStore(STORE_ROWS).index('status');
    const req = idx.count(IDBKeyRange.only(status));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function countAllRows() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readonly');
    const req = tx.objectStore(STORE_ROWS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 取出某個狀態（pending / success / failed）的一批資料，最多 limit 筆。
// 用於 worker 端一批一批處理，避免一次把 90 萬筆全部撈進記憶體。
export async function fetchByStatus(status, limit = 2000) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readonly');
    const idx = tx.objectStore(STORE_ROWS).index('status');
    const req = idx.openCursor(IDBKeyRange.only(status));
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// 依照原始列順序（idx 遞增）取出「全部」資料，用於匯出 CSV。
// 90 萬筆欄位物件全部載入記憶體一次，對這個規模是可接受的（一次性操作）。
export async function getAllRowsOrdered() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROWS, 'readonly');
    const store = tx.objectStore(STORE_ROWS);
    const req = store.openCursor(); // primary key 是數字 idx，預設遞增
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
