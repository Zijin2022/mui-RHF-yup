import React, { useEffect, useRef, useState, useCallback } from 'react';
import Papa from 'papaparse';
import { getJob, countByStatus, countAllRows, getAllRowsOrdered, clearAll } from './db.js';

const DEFAULT_HEADERS_TEXT = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_BODY_TEXT = '{\n  "value": "{{欄位名稱}}"\n}';

function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} 小時 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

export default function App() {
  const workerRef = useRef(null);
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [apiUrl, setApiUrl] = useState('https://api.example.com/lookup');
  const [apiMethod, setApiMethod] = useState('POST');
  const [headersText, setHeadersText] = useState(DEFAULT_HEADERS_TEXT);
  const [bodyText, setBodyText] = useState(DEFAULT_BODY_TEXT);
  const [resultPath, setResultPath] = useState('data.result');
  const [resultFieldName, setResultFieldName] = useState('api_result');
  const [concurrency, setConcurrency] = useState(30);

  const [jobStatus, setJobStatus] = useState('idle'); // idle | parsing | running | paused | done | stopped | error
  const [progress, setProgress] = useState({ processed: 0, total: 0, success: 0, failed: 0, ratePerSec: 0 });
  const [parsedCount, setParsedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  const [existingJob, setExistingJob] = useState(null);
  const [existingCounts, setExistingCounts] = useState(null);

  // 檢查上次是否有未完成的匯入
  useEffect(() => {
    (async () => {
      try {
        const job = await getJob();
        if (job) {
          const [pending, success, failed, total] = await Promise.all([
            countByStatus('pending'),
            countByStatus('success'),
            countByStatus('failed'),
            countAllRows(),
          ]);
          if (total > 0) {
            setExistingJob(job);
            setExistingCounts({ pending, success, failed, total });
          }
        }
      } catch (err) {
        // 沒有資料庫或讀取失敗就當作沒有舊任務
      }
    })();
  }, []);

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(new URL('./importWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
          case 'PARSE_PROGRESS':
            setParsedCount(msg.parsed);
            break;
          case 'PARSE_DONE':
            setProgress((p) => ({ ...p, total: msg.total }));
            setJobStatus('running');
            break;
          case 'PROGRESS':
            setProgress({
              processed: msg.processed,
              total: msg.total,
              success: msg.success,
              failed: msg.failed,
              ratePerSec: msg.ratePerSec,
            });
            break;
          case 'DONE':
            setJobStatus('done');
            break;
          case 'STOPPED':
            setJobStatus('stopped');
            break;
          case 'ERROR':
            setJobStatus('error');
            setErrorMessage(msg.message);
            break;
          default:
            break;
        }
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  function buildApiConfig() {
    let headers = {};
    try {
      headers = headersText.trim() ? JSON.parse(headersText) : {};
    } catch (err) {
      throw new Error('Headers 欄位不是合法的 JSON');
    }
    return {
      url: apiUrl,
      method: apiMethod,
      headers,
      bodyTemplate: bodyText,
      resultPath,
    };
  }

  const handleStart = () => {
    setErrorMessage('');
    if (!file) {
      setErrorMessage('請先選擇要匯入的 CSV 檔案');
      return;
    }
    let apiConfig;
    try {
      apiConfig = buildApiConfig();
    } catch (err) {
      setErrorMessage(err.message);
      return;
    }
    const worker = ensureWorker();
    setJobStatus('parsing');
    setParsedCount(0);
    setProgress({ processed: 0, total: 0, success: 0, failed: 0, ratePerSec: 0 });
    worker.postMessage({
      type: 'START',
      payload: { file, apiConfig, resultFieldName, concurrency: Number(concurrency) },
    });
  };

  const handlePause = () => {
    workerRef.current?.postMessage({ type: 'PAUSE' });
    setJobStatus('paused');
  };

  const handleResume = () => {
    workerRef.current?.postMessage({ type: 'RESUME' });
    setJobStatus('running');
  };

  const handleStop = () => {
    if (!window.confirm('確定要停止這次匯入嗎？已完成的資料仍會保留在資料庫中。')) return;
    workerRef.current?.postMessage({ type: 'STOP' });
  };

  const handleResumePrevious = async () => {
    if (!existingJob) return;
    const worker = ensureWorker();
    setApiUrl(existingJob.apiConfig?.url || apiUrl);
    setApiMethod(existingJob.apiConfig?.method || apiMethod);
    setHeadersText(JSON.stringify(existingJob.apiConfig?.headers || {}, null, 2));
    setBodyText(existingJob.apiConfig?.bodyTemplate || bodyText);
    setResultPath(existingJob.apiConfig?.resultPath || resultPath);
    setResultFieldName(existingJob.resultFieldName || resultFieldName);
    setConcurrency(existingJob.concurrency || concurrency);
    setJobStatus('running');
    setProgress((p) => ({ ...p, total: existingCounts?.total || existingJob.totalRows || 0 }));
    worker.postMessage({
      type: 'RESUME_EXISTING',
      payload: {
        apiConfig: existingJob.apiConfig,
        resultFieldName: existingJob.resultFieldName,
        concurrency: existingJob.concurrency,
        total: existingCounts?.total || existingJob.totalRows,
      },
    });
    setExistingJob(null);
  };

  const handleDiscardPrevious = async () => {
    if (!window.confirm('確定要放棄上次未完成的匯入並清除資料嗎？此動作無法復原。')) return;
    await clearAll();
    setExistingJob(null);
    setExistingCounts(null);
  };

  const handleExport = async () => {
    setExporting(true);
    setErrorMessage('');
    try {
      const job = await getJob();
      const rows = await getAllRowsOrdered();
      if (!rows.length) {
        setErrorMessage('目前資料庫裡沒有可匯出的資料');
        return;
      }
      const headers = [...(job?.headers || Object.keys(rows[0].data)), job?.resultFieldName].filter(Boolean);
      const CHUNK = 5000;
      const parts = [Papa.unparse([headers]) + '\r\n'];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK).map((r) => headers.map((h) => r.data[h] ?? ''));
        parts.push(Papa.unparse(slice, { header: false }) + '\r\n');
      }
      const blob = new Blob(parts, { type: 'text/csv;charset=utf-8;' });

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'export.csv',
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setErrorMessage('匯出失敗：' + (err.message || String(err)));
      }
    } finally {
      setExporting(false);
    }
  };

  const total = progress.total || 0;
  const processedPct = total ? (progress.processed / total) * 100 : 0;
  const successPct = total ? (progress.success / total) * 100 : 0;
  const failedPct = total ? (progress.failed / total) * 100 : 0;
  const remaining = total - progress.processed;
  const etaSeconds = progress.ratePerSec > 0 ? remaining / progress.ratePerSec : Infinity;

  const isRunningPhase = ['parsing', 'running', 'paused'].includes(jobStatus);
  const canExport = jobStatus === 'done' || jobStatus === 'stopped' || (existingCounts && !isRunningPhase);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">CSV</span>
          <div>
            <h1>批次匯入工作台</h1>
            <p className="subtitle">逐筆讀取 → 呼叫 API → 寫回結果 → 匯出 CSV</p>
          </div>
        </div>
      </header>

      {existingJob && existingCounts && (
        <div className="banner">
          <div>
            <strong>偵測到尚未完成的匯入</strong>
            <p>
              共 {existingCounts.total.toLocaleString()} 筆，已完成 {(existingCounts.success + existingCounts.failed).toLocaleString()}
              　（成功 {existingCounts.success.toLocaleString()}、失敗 {existingCounts.failed.toLocaleString()}）、
              待處理 {existingCounts.pending.toLocaleString()} 筆。
            </p>
          </div>
          <div className="banner-actions">
            <button className="btn btn-primary" onClick={handleResumePrevious}>繼續上次任務</button>
            <button className="btn btn-ghost" onClick={handleDiscardPrevious}>放棄並清除</button>
          </div>
        </div>
      )}

      <main className="layout">
        <section className="panel">
          <h2>1. 選擇檔案</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            disabled={isRunningPhase}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file && <p className="hint">已選擇：{file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）</p>}
        </section>

        <section className="panel">
          <h2>2. API 設定</h2>
          <div className="field">
            <label>API URL（可用 {'{{欄位名稱}}'} 代入 CSV 欄位值）</label>
            <input
              type="text"
              value={apiUrl}
              disabled={isRunningPhase}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Method</label>
              <select value={apiMethod} disabled={isRunningPhase} onChange={(e) => setApiMethod(e.target.value)}>
                <option>POST</option>
                <option>GET</option>
                <option>PUT</option>
              </select>
            </div>
            <div className="field">
              <label>同時併發數（concurrency）</label>
              <input
                type="number"
                min="1"
                max="200"
                value={concurrency}
                disabled={isRunningPhase}
                onChange={(e) => setConcurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Headers（JSON）</label>
            <textarea rows={4} value={headersText} disabled={isRunningPhase} onChange={(e) => setHeadersText(e.target.value)} />
          </div>
          <div className="field">
            <label>Request Body 樣板（{'{{欄位名稱}}'} 會被換成該列的值）</label>
            <textarea rows={4} value={bodyText} disabled={isRunningPhase} onChange={(e) => setBodyText(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>回應中要取用的欄位路徑（dot path，例如 data.result）</label>
              <input type="text" value={resultPath} disabled={isRunningPhase} onChange={(e) => setResultPath(e.target.value)} />
            </div>
            <div className="field">
              <label>寫回 CSV 的新欄位名稱</label>
              <input
                type="text"
                value={resultFieldName}
                disabled={isRunningPhase}
                onChange={(e) => setResultFieldName(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>3. 執行</h2>
          <div className="controls">
            {jobStatus === 'idle' || jobStatus === 'done' || jobStatus === 'stopped' || jobStatus === 'error' ? (
              <button className="btn btn-primary" onClick={handleStart}>開始匯入</button>
            ) : null}
            {jobStatus === 'running' && <button className="btn btn-warn" onClick={handlePause}>暫停</button>}
            {jobStatus === 'paused' && <button className="btn btn-primary" onClick={handleResume}>繼續</button>}
            {(jobStatus === 'running' || jobStatus === 'paused') && (
              <button className="btn btn-ghost" onClick={handleStop}>停止</button>
            )}
            <button className="btn btn-outline" disabled={!canExport || exporting} onClick={handleExport}>
              {exporting ? '匯出中…' : '匯出 CSV'}
            </button>
          </div>

          {errorMessage && <p className="error">{errorMessage}</p>}

          {jobStatus === 'parsing' && (
            <p className="hint">正在讀取 CSV 並寫入本機資料庫… 已讀取 {parsedCount.toLocaleString()} 筆</p>
          )}

          {total > 0 && (
            <div className="progress-block">
              <div className="stacked-bar">
                <div className="bar-success" style={{ width: `${successPct}%` }} />
                <div className="bar-failed" style={{ width: `${failedPct}%` }} />
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-label">總筆數</span>
                  <span className="stat-value">{total.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">已處理</span>
                  <span className="stat-value">{progress.processed.toLocaleString()}（{processedPct.toFixed(1)}%）</span>
                </div>
                <div className="stat stat-ok">
                  <span className="stat-label">成功</span>
                  <span className="stat-value">{progress.success.toLocaleString()}</span>
                </div>
                <div className="stat stat-fail">
                  <span className="stat-label">失敗</span>
                  <span className="stat-value">{progress.failed.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">速度</span>
                  <span className="stat-value">{progress.ratePerSec.toFixed(1)} 筆/秒</span>
                </div>
                <div className="stat">
                  <span className="stat-label">預估剩餘時間</span>
                  <span className="stat-value">{jobStatus === 'running' ? formatDuration(etaSeconds) : '--'}</span>
                </div>
              </div>
              <p className="status-line">
                狀態：
                <strong>
                  {{
                    idle: '尚未開始',
                    parsing: '讀取 CSV 中',
                    running: '執行中',
                    paused: '已暫停',
                    done: '已完成',
                    stopped: '已停止',
                    error: '發生錯誤',
                  }[jobStatus]}
                </strong>
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>資料處理與 API 呼叫都在瀏覽器背景執行緒（Web Worker）進行，關閉分頁前建議先暫停或等待完成。</p>
      </footer>
    </div>
  );
}
