// src/lib/mockData.js
// Generates realistic mock log data for the UI

const HOSTS = ['web-01', 'web-02', 'api-01', 'api-02', 'db-01', 'worker-01', 'gateway'];
const APPS = ['nginx', 'api-service', 'auth-service', 'db-proxy', 'queue-worker', 'metrics-agent'];
const ENVS = ['prod', 'staging', 'dev'];
const LEVELS = ['CRITICAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
const LEVEL_WEIGHTS = [0.02, 0.08, 0.10, 0.65, 0.15];

const MESSAGES = {
  CRITICAL: [
    '[nginx] 503 Service Unavailable - upstream connection refused on /api/v1/checkout',
    '[kernel] Out of memory: Kill process 1042 (node) score 982 or sacrifice child',
    '[db-proxy] FATAL: max_connections exceeded – rejecting new client connections',
    '[auth-service] CRITICAL: JWT secret mismatch – potential token forgery attempt detected',
  ],
  ERROR: [
    '[nginx] 500 Internal Server Error in /api/v1/checkout',
    '[api-service] Unhandled exception in OrderController: TypeError: Cannot read property "id" of undefined',
    '[db-proxy] Connection pool exhausted after 30s timeout – query dropped',
    '[queue-worker] Failed to process job #9821: Redis NOAUTH Authentication required',
    '[auth-service] Invalid or expired token from 192.168.20.155',
  ],
  WARN: [
    '[nginx] 429 Too Many Requests – rate limit triggered for IP 10.0.4.22',
    '[api-service] Response time exceeded SLA threshold: 2847ms (SLA: 500ms)',
    '[db-proxy] Slow query detected: SELECT * FROM orders took 1204ms',
    '[queue-worker] Retry attempt 3/5 for job #9820 after backoff',
    '[metrics-agent] Memory usage at 87% – consider scaling',
  ],
  INFO: [
    '[nginx] 200 GET /api/v1/products?limit=20 – 192.168.20.153 483ms',
    '[api-service] User session created: uid=usr_a8f2bc, tenant=acme-corp',
    '[auth-service] Successful login for admin@acme.corp from 10.0.1.5',
    '[queue-worker] Job #9823 completed successfully in 142ms',
    '[db-proxy] Connection pool: 45/100 active connections',
    '[nginx] 201 POST /api/v1/orders – order_id=ord_0ef9a2 created',
    '[metrics-agent] Metrics flushed: 1240 samples in 50ms',
  ],
  DEBUG: [
    '[nginx] Cache HIT for /static/assets/main.js (TTL: 3600s remaining)',
    '[api-service] Redis cache miss for key: user:session:usr_a8f2bc – fetching from DB',
    '[db-proxy] Query plan: INDEX SCAN on orders(created_at) – est. 142 rows',
    '[queue-worker] Polling queue: depth=3, idle workers=8',
    '[auth-service] Token validation: alg=RS256, exp=valid, iss=logshift-auth',
  ],
};

function weightedRandom(items, weights) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i];
    if (r < cum) return items[i];
  }
  return items[items.length - 1];
}

let logIdCounter = 1;

export function generateLog(overrides = {}) {
  const level = weightedRandom(LEVELS, LEVEL_WEIGHTS);
  const msgs = MESSAGES[level] || MESSAGES.INFO;
  const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
  const app = APPS[Math.floor(Math.random() * APPS.length)];
  const env = ENVS[Math.floor(Math.random() * ENVS.length)];
  const now = Date.now();
  const pid = Math.floor(Math.random() * 32768) + 1;
  const facility = Math.floor(Math.random() * 24);

  return {
    id: `log-${now}-${logIdCounter++}`,
    timestampNs: now * 1_000_000,
    timestamp: new Date(now).toISOString(),
    level,
    host,
    app,
    env,
    message: msgs[Math.floor(Math.random() * msgs.length)],
    meta: {
      pid,
      facility,
      stream: `${app}/${env}`,
      path: `/var/log/${app}.log`,
      status: level === 'INFO' ? 200 : level === 'WARN' ? 429 : 500,
    },
    ...overrides,
  };
}

export function generateInitialLogs(count = 200) {
  const logs = [];
  const baseTime = Date.now() - count * 300; // spread over ~60s
  for (let i = 0; i < count; i++) {
    const ts = baseTime + i * 300 + Math.random() * 200;
    const level = weightedRandom(LEVELS, LEVEL_WEIGHTS);
    const msgs = MESSAGES[level] || MESSAGES.INFO;
    const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
    const app = APPS[Math.floor(Math.random() * APPS.length)];
    const env = ENVS[Math.floor(Math.random() * ENVS.length)];
    const pid = Math.floor(Math.random() * 32768) + 1;

    logs.push({
      id: `log-init-${i}`,
      timestampNs: ts * 1_000_000,
      timestamp: new Date(ts).toISOString(),
      level,
      host,
      app,
      env,
      message: msgs[Math.floor(Math.random() * msgs.length)],
      meta: {
        pid,
        facility: Math.floor(Math.random() * 24),
        stream: `${app}/${env}`,
        path: `/var/log/${app}.log`,
        status: level === 'INFO' ? 200 : level === 'WARN' ? 429 : 500,
      },
    });
  }
  return logs.reverse(); // newest first
}

export function generateHistogramData(minutes = 15, intervalMin = 0.5) {
  const buckets = [];
  const now = Date.now();
  const total = Math.ceil(minutes / intervalMin);

  for (let i = total - 1; i >= 0; i--) {
    const t = new Date(now - i * intervalMin * 60 * 1000);
    const label = t.toISOString().substr(11, 5);
    const spike = Math.random() > 0.85;
    const base = spike ? Math.random() * 8000 + 12000 : Math.random() * 4000 + 2000;

    buckets.push({
      time: label,
      critical: Math.floor(base * 0.02 * Math.random()),
      error: Math.floor(base * 0.08 * Math.random()),
      warn: Math.floor(base * 0.10 * Math.random()),
      info: Math.floor(base * 0.65 * Math.random()),
      debug: Math.floor(base * 0.15 * Math.random()),
    });
  }
  return buckets;
}

export const STREAM_FACETS = [
  { label: 'app="nginx"', key: 'app', value: 'nginx', count: 439, active: true },
  { label: 'app="api-service"', key: 'app', value: 'api-service', count: 284, active: false },
  { label: 'env="prod"', key: 'env', value: 'prod', count: 312, active: true },
  { label: 'env="staging"', key: 'env', value: 'staging', count: 89, active: false },
  { label: 'host="web-01"', key: 'host', value: 'web-01', count: 179, active: true },
  { label: 'host="web-02"', key: 'host', value: 'web-02', count: 134, active: false },
  { label: 'host="api-01"', key: 'host', value: 'api-01', count: 98, active: false },
  { label: 'host="db-01"', key: 'host', value: 'db-01', count: 47, active: false },
];

export const TIME_RANGES = [
  { label: 'Last 5m', minutes: 5 },
  { label: 'Last 15m', minutes: 15 },
  { label: 'Last 1h', minutes: 60 },
  { label: 'Last 6h', minutes: 360 },
  { label: 'Last 24h', minutes: 1440 },
];
