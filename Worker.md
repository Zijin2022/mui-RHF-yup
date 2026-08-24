// importWorker.js
// 這支檔案在背景執行緒（Web Worker）跑，不會卡住畫面。
// 職責：
//   1. 用 PapaParse 串流讀取 CSV，逐批寫入 IndexedDB
//   2. 用併發池逐筆呼叫 API
//   3. 把 API 結果寫回 IndexedDB 對應那一列
//   4. 定期回報進度給主執行緒（main thread）

import Papa from 'papaparse';
import { saveJob, putRowsBulk, putRow, fetchByStatus, clearAll } from './db.js';

let isPaused = false;
let shouldStop = false;

let concurrencyLimit = 30;
let totalRows = 0;
let processedCount = 0;
let successCount = 0;
let failedCount = 0;

let lastReportTime = 0;
let lastReportCount = 0;
const REPORT_INTERVAL_MS = 300;

function resetCounters() {
  processedCount = 0;
  successCount = 0;
  failedCount = 0;
  lastReportTime = performance.now();
  lastReportCount = 0;
}

function waitForResume() {
  return new Promise((resolve) => {
    const check = () => {
      if (!isPaused || shouldStop) resolve();
      else setTimeout(check, 200);
    };
    check();
  });
}

function reportProgress(force = false) {
  const now = performance.now();
  if (!force && now - lastReportTime < REPORT_INTERVAL_MS) return;
  const elapsedSec = (now - lastReportTime) / 1000;
  const delta = processedCount - lastReportCount;
  const rate = elapsedSec > 0 ? delta / elapsedSec : 0;
  lastReportTime = now;
  lastReportCount = processedCount;
  postMessage({
    type: 'PROGRESS',
    processed: processedCount,
    success: successCount,
    failed: failedCount,
    total: totalRows,
    ratePerSec: rate,
  });
}

// 把 {{欄位名}} 樣板字串代換成該列實際資料
function renderTemplate(template, data) {
  if (!template) return template;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const v = data[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

// 依 dot-path（例如 "data.result" 或 "result"）從物件中取值
function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function processRow(row, apiConfig, resultFieldName) {
  const { url, method, headers, bodyTemplate, resultPath } = apiConfig;
  try {
    const finalUrl = renderTemplate(url, row.data);
    const finalMethod = (method || 'POST').toUpperCase();
    const fetchOptions = {
      method: finalMethod,
      headers: headers && Object.keys(headers).length ? headers : { 'Content-Type': 'application/json' },
    };
    if (finalMethod !== 'GET' && finalMethod !== 'HEAD') {
      fetchOptions.body = renderTemplate(bodyTemplate, row.data);
    }
    const res = await fetch(finalUrl, fetchOptions);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const value = resultPath ? getByPath(json, resultPath) : json;
    row.data[resultFieldName] = value;
    row.status = 'success';
    row.error = null;
    await putRow(row);
    successCount++;
  } catch (err) {
    row.retryCount = (row.retryCount || 0) + 1;
    if (row.retryCount <= 3) {
      row.status = 'pending';
      row.error = String(err && err.message ? err.message : err);
      await putRow(row);
    } else {
      row.status = 'failed';
      row.error = String(err && err.message ? err.message : err);
      await putRow(row);
      failedCount++;
    }
  }
  processedCount++;
  reportProgress();
}

async function processBatch(rows, apiConfig, resultFieldName) {
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      if (shouldStop) return;
      if (isPaused) await waitForResume();
      if (shouldStop) return;
      const row = rows[cursor++];
      await processRow(row, apiConfig, resultFieldName);
    }
  }
  const workers = Array.from({ length: Math.min(concurrencyLimit, rows.length) }, () => worker());
  await Promise.all(workers);
}

async function runDispatchLoop(apiConfig, resultFieldName) {
  while (true) {
    if (shouldStop) break;
    if (isPaused) await waitForResume();
    if (shouldStop) break;
    const batch = await fetchByStatus('pending', 2000);
    if (batch.length === 0) break;
    await processBatch(batch, apiConfig, resultFieldName);
  }
  reportProgress(true);
  postMessage({ type: shouldStop ? 'STOPPED' : 'DONE' });
}

async function parseAndStart({ file, apiConfig, resultFieldName, concurrency }) {
  shouldStop = false;
  isPaused = false;
  concurrencyLimit = concurrency || 30;
  resetCounters();

  await clearAll();

  let idxCounter = 0;
  let buffer = [];
  let headers = [];
  const BULK_SIZE = 1000;

  await new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: false, // 我們已經在 worker 裡了，不需要 Papa 自己再開一個
      chunk: async (results, parser) => {
        parser.pause();
        if (headers.length === 0) headers = results.meta.fields || [];
        for (const data of results.data) {
          buffer.push({ idx: idxCounter++, data, status: 'pending', retryCount: 0, error: null });
        }
        if (buffer.length >= BULK_SIZE) {
          const toWrite = buffer;
          buffer = [];
          await putRowsBulk(toWrite);
          postMessage({ type: 'PARSE_PROGRESS', parsed: idxCounter });
        }
        parser.resume();
      },
      complete: async () => {
        if (buffer.length) {
          await putRowsBulk(buffer);
          buffer = [];
        }
        totalRows = idxCounter;
        await saveJob({
          headers,
          totalRows,
          apiConfig,
          resultFieldName,
          concurrency: concurrencyLimit,
          createdAt: Date.now(),
        });
        postMessage({ type: 'PARSE_DONE', total: totalRows });
        resolve();
      },
      error: (err) => reject(err),
    });
  });

  await runDispatchLoop(apiConfig, resultFieldName);
}

async function resumeExisting({ apiConfig, resultFieldName, concurrency, total }) {
  shouldStop = false;
  isPaused = false;
  concurrencyLimit = concurrency || 30;
  totalRows = total || 0;
  resetCounters();
  await runDispatchLoop(apiConfig, resultFieldName);
}

self.onmessage = async (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'START':
      parseAndStart(msg.payload).catch((err) =>
        postMessage({ type: 'ERROR', message: String(err && err.message ? err.message : err) })
      );
      break;
    case 'RESUME_EXISTING':
      resumeExisting(msg.payload).catch((err) =>
        postMessage({ type: 'ERROR', message: String(err && err.message ? err.message : err) })
      );
      break;
    case 'PAUSE':
      isPaused = true;
      break;
    case 'RESUME':
      isPaused = false;
      break;
    case 'STOP':
      shouldStop = true;
      isPaused = false;
      break;
    default:
      break;
  }
};
