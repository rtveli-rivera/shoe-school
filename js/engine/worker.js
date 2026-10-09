// worker.js — computes a strategy chart off the main thread (Web Worker only).
import { getChart } from './strategy.js';

self.onmessage = (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === 'chart') self.postMessage({ ok: true, chart: getChart(msg.rules) });
    else self.postMessage({ ok: false, error: `Unknown message: ${msg.type}` });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
