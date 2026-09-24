// src/lib/queryParser.js
// Parses the Loki/ES hybrid query syntax used in the query bar
// and normalizes raw gRPC LogEntry objects for display.

// ── Severity keyword detection (ordered: most severe first) ──────────
const SEV_KEYWORDS = [
  ['critical', 'CRITICAL'], ['fatal', 'CRITICAL'],
  ['error', 'ERROR'],       ['err',   'ERROR'],
  ['warn',  'WARN'],        ['warning', 'WARN'],
  ['debug', 'DEBUG'],       ['dbg',   'DEBUG'],
  ['trace', 'TRACE'],
  // default falls through to INFO
];

// RFC syslog PRI → severity (PRI & 7 = severity bits)
const PRI_TO_SEV = ['CRITICAL','CRITICAL','CRITICAL','ERROR','WARN','INFO','INFO','DEBUG'];

/**
 * Parse a Loki/ES hybrid query string.
 *
 * Input:  `{app="nginx", env="prod"} | "error" OR "timeout"`
 * Output: {
 *   labels:      [{ key: "app", value: "nginx" }, ...]  // label selector filters
 *   terms:       ["error", "timeout"]                   // all extracted search terms
 *   primaryTerm: "error"                                // first term → sent to backend as ?term=
 *   raw:         <original string>
 * }
 *
 * The backend proto only supports a single `term` field, so `primaryTerm`
 * is what gets sent to /api/logs/search. Label filters are applied
 * client-side against the normalised log objects.
 */
export function parseQuery(queryStr = '') {
  const labels = [];
  const terms  = [];

  // 1. Extract {key="value"} block
  const labelBlock = queryStr.match(/\{([^}]*)\}/);
  if (labelBlock) {
    const re = /(\w+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(labelBlock[1])) !== null) {
      labels.push({ key: m[1], value: m[2] });
    }
  }

  // 2. Extract search terms after the pipe |
  const pipeSection = queryStr.match(/\|\s*(.+)$/);
  if (pipeSection) {
    // Prefer quoted strings  "error"
    const quotedRe = /"([^"]+)"/g;
    let m;
    while ((m = quotedRe.exec(pipeSection[1])) !== null) terms.push(m[1]);

    // Fall back to bare words split by OR/AND
    if (terms.length === 0) {
      pipeSection[1]
        .split(/\s+(?:OR|AND)\s+/i)
        .map(w => w.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .forEach(w => terms.push(w));
    }
  }

  return {
    labels,
    terms,
    primaryTerm: terms[0] || '',
    raw: queryStr,
  };
}

/**
 * Convert a time-range selection (minutes) to { startMs, endMs } in epoch ms.
 */
export function timeRangeToMs(minutes) {
  const endMs = Date.now();
  return { startMs: endMs - minutes * 60_000, endMs };
}

/**
 * Normalise a raw gRPC LogEntry → internal display log object.
 *
 * gRPC shape: { timestamp_nano: string|number, message: string }
 *
 * We attempt to parse standard syslog formats (RFC5424 / RFC3164),
 * then fall back to keyword detection for severity and `[app]` for app name.
 */
export function normalizeLogEntry(entry, index) {
  const tsNano = entry.timestamp_nano ? Number(entry.timestamp_nano) : null;
  const timestamp = tsNano
    ? new Date(Math.floor(tsNano / 1_000_000)).toISOString()
    : entry.timestamp || new Date().toISOString();

  const rawMsg = entry.message || '';
  const id = entry.id || `grpc-${tsNano ?? Date.now()}-${index}`;

  // ── RFC 5424 ──────────────────────────────────────────────────────
  // <PRI>1 TIMESTAMP HOST APP PROCID MSGID SD MSG
  const r5424 = rawMsg.match(
    /^<(\d+)>1\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+\S+\s+([\s\S]*)$/
  );
  if (r5424) {
    const sev = PRI_TO_SEV[parseInt(r5424[1]) & 7] ?? 'INFO';
    return {
      id, timestamp, level: sev,
      host: r5424[2] === '-' ? 'unknown' : r5424[2],
      app:  r5424[3] === '-' ? 'syslog'  : r5424[3],
      env:  'prod',
      message: r5424[5],
      meta: { pid: r5424[4], facility: Math.floor(parseInt(r5424[1]) / 8), raw: rawMsg },
    };
  }

  // ── RFC 3164 ──────────────────────────────────────────────────────
  // <PRI>Mmm DD HH:MM:SS HOSTNAME APP[PID]: MSG
  const r3164 = rawMsg.match(
    /^<(\d+)>\w+\s+\d+\s+[\d:]+\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+([\s\S]*)$/
  );
  if (r3164) {
    const sev = PRI_TO_SEV[parseInt(r3164[1]) & 7] ?? 'INFO';
    return {
      id, timestamp, level: sev,
      host: r3164[2],
      app:  r3164[3],
      env:  'prod',
      message: r3164[5],
      meta: { pid: r3164[4] ?? '-', facility: Math.floor(parseInt(r3164[1]) / 8), raw: rawMsg },
    };
  }

  // ── Plain / structured line ───────────────────────────────────────
  // Detect severity from keywords
  const lower = rawMsg.toLowerCase();
  let detectedLevel = 'INFO';
  for (const [kw, sev] of SEV_KEYWORDS) {
    if (lower.includes(kw)) { detectedLevel = sev; break; }
  }

  // Extract [appname] if present at start of message
  const appMatch = rawMsg.match(/^\[([^\]]+)\]/);
  const app = appMatch ? appMatch[1] : (entry.app || 'engine');

  // Try to grab a hostname-like token (word before first space after optional PRI)
  const hostMatch = rawMsg.match(/^(?:<\d+>)?\S+\s+(\S+)/);
  const host = entry.host || hostMatch?.[1] || 'unknown';

  return {
    id, timestamp,
    level:   detectedLevel,
    host,
    app,
    env:     entry.env || 'prod',
    message: rawMsg,
    meta:    { raw: rawMsg, ...entry.meta },
  };
}

/**
 * After getting real logs from the backend, apply client-side label filters
 * (the backend only filters by term; label selectors are applied here).
 */
export function applyLabelFilters(logs, labels) {
  if (!labels.length) return logs;
  return logs.filter(log =>
    labels.every(({ key, value }) => {
      if (key === 'host')    return log.host === value;
      if (key === 'app')     return log.app  === value;
      if (key === 'env')     return log.env  === value;
      // fallthrough: check meta
      return String(log.meta?.[key] ?? '') === value;
    })
  );
}
