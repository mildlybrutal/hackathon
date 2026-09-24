import crypto from 'crypto';
import { client } from './logClient.js';

const LOOKBACK_MS = 5 * 60 * 1000;
const LIMIT = 5000;

function entryKey(entry) {
  return crypto.createHash('sha1').update(JSON.stringify(entry)).digest('hex');
}

export function createLiveTail(ws, { term, pollMs }) {
  let stopped = false;
  let timer;
  let activeCall;
  const seen = new Map();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (activeCall) activeCall.cancel();
  };

  const poll = () => {
    if (stopped || ws.readyState !== ws.OPEN) return stop();
    const now = Date.now();
    activeCall = client.Query({
      term,
      start_time_nano: Math.trunc((now - LOOKBACK_MS) * 1e6),
      end_time_nano: Math.trunc(now * 1e6),
      limit: LIMIT,
    }, (err, response) => {
      activeCall = undefined;
      if (stopped) return;
      if (err || response?.error) {
        ws.send(JSON.stringify({ type: 'error', error: err?.message || response.error }));
      } else {
        const current = new Map();
        for (const entry of response.logs || []) {
          const key = entryKey(entry);
          const occurrence = (current.get(key) || 0) + 1;
          current.set(key, occurrence);
          if (occurrence > (seen.get(key) || 0)) {
            ws.send(JSON.stringify({ type: 'log', log: { ...entry, received_at: new Date().toISOString() } }));
          }
        }
        for (const [key, count] of current) seen.set(key, count);
        ws.send(JSON.stringify({ type: 'status', state: 'connected' }));
      }
      timer = setTimeout(poll, pollMs);
    });
  };

  ws.send(JSON.stringify({ type: 'status', state: 'connecting' }));
  poll();
  return { stop };
}
