// server/src/controllers/queryController.js
import { client } from '../services/logClient.js';

// ── Mock data for when the Go engine is offline ───────────────────────
const MOCK_LEVELS   = ['CRITICAL','ERROR','ERROR','WARN','INFO','INFO','INFO','INFO','DEBUG'];
const MOCK_HOSTS    = ['web-01','web-02','api-01','api-02','db-01','worker-01'];
const MOCK_APPS     = ['nginx','api-service','auth-service','db-proxy','queue-worker'];
const MOCK_MESSAGES = [
  '[nginx] 200 GET /api/v1/products?limit=20 – 192.168.20.153 48ms',
  '[nginx] 500 Internal Server Error in /api/v1/checkout',
  '[nginx] 429 Too Many Requests – rate limit triggered for IP 10.0.4.22',
  '[api-service] Unhandled exception: TypeError: Cannot read property "id" of undefined',
  '[api-service] User session created: uid=usr_a8f2bc, tenant=acme-corp',
  '[api-service] Cache miss for user:session:usr_a8f2bc – fetching from DB',
  '[auth-service] Token validation OK alg=RS256 exp=valid',
  '[auth-service] Invalid or expired token from 192.168.20.155',
  '[db-proxy] Connection pool: 45/100 active connections',
  '[db-proxy] Slow query detected: SELECT * FROM orders took 1204ms',
  '[queue-worker] Job #9823 completed successfully in 142ms',
  '[queue-worker] Retry attempt 3/5 for job #9820 after backoff',
];

function makeMockEntry(termFilter) {
  const level   = MOCK_LEVELS[Math.floor(Math.random() * MOCK_LEVELS.length)];
  const host    = MOCK_HOSTS[Math.floor(Math.random() * MOCK_HOSTS.length)];
  const app     = MOCK_APPS[Math.floor(Math.random() * MOCK_APPS.length)];
  let   message = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];

  // If a term filter is active, occasionally inject it so the stream looks relevant
  if (termFilter && Math.random() > 0.6) {
    message = message.replace(/\[[\w-]+\]/, `[${app}]`) + ` (${termFilter})`;
  }

  return {
    timestamp_nano: String(Date.now() * 1_000_000),
    message,
    level,
    host,
    app,
    env: 'prod',
  };
}

// ── Batch search query (one-shot) ─────────────────────────────────────
export function handleSearch(req, res) {
  const { term, startTime, endTime, limit } = req.query;

  const payload = {
    term:             term || '',
    start_time_nano:  Number(startTime || 0) * 1e6,   // ms → ns
    end_time_nano:    Number(endTime   || Date.now()) * 1e6,
    limit:            parseInt(limit, 10) || 100,
  };

  client.Query(payload, (err, response) => {
    if (err) {
      console.error('[gRPC Query Error]:', err.message);
      return res.status(500).json({ error: err.message });
    }
    return res.json({
      meta: {
        count:          response.logs?.length ?? 0,
        executionTimeNs: response.execution_time_ns ?? 0,
      },
      logs: response.logs || [],
    });
  });
}

// ── SSE live-tail stream ──────────────────────────────────────────────
export function handleStreamSearch(req, res) {
  const termFilter = req.query.term || '';
  let   isClosed   = false;
  let   grpcStream  = null;
  let   mockTimer   = null;

  // Send SSE headers immediately so EventSource gets HTTP 200 right away
  // (without this the connection looks like a failure if gRPC hangs)
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
  res.flushHeaders();

  // Helper: write one SSE data frame
  const sendEntry = (entry) => {
    if (!isClosed) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
  };

  // Helper: send a heartbeat comment to keep the connection alive
  const heartbeat = setInterval(() => {
    if (!isClosed) res.write(': heartbeat\n\n');
  }, 15_000);

  // Fallback: stream synthetic logs when gRPC engine is unavailable
  const startMockStream = (reason) => {
    console.warn(`[SSE] gRPC unavailable (${reason}) – streaming synthetic logs`);
    // Announce mock mode to the client
    sendEntry({ _mock: true, message: `[logshift] Engine offline – streaming demo data` });
    mockTimer = setInterval(() => {
      if (isClosed) { clearInterval(mockTimer); return; }
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) sendEntry(makeMockEntry(termFilter));
    }, 350);
  };

  // Cleanup on connection close
  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    clearInterval(heartbeat);
    if (mockTimer) clearInterval(mockTimer);
    if (grpcStream) { try { grpcStream.cancel(); } catch (_) {} }
  };

  // Try the real gRPC StreamQuery
  try {
    grpcStream = client.StreamQuery({
      term:             termFilter,
      start_time_nano:  0,
      end_time_nano:    Date.now() * 1_000_000_000, // ns
      limit:            500,
    });

    grpcStream.on('data',  sendEntry);
    grpcStream.on('end',   () => { if (!isClosed) res.end(); cleanup(); });
    grpcStream.on('error', (err) => {
      // Don't close the SSE connection — fall back to mock so EventSource stays open
      startMockStream(err.message);
    });

  } catch (err) {
    // Synchronous failure (e.g. proto not loaded)
    startMockStream(err.message);
  }

  // Client disconnected (tab closed, toggle off, etc.)
  req.on('close', cleanup);
}