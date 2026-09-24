// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

import TopNav from './components/TopNav';
import QueryBar from './components/QueryBar';
import VolumeHistogram from './components/VolumeHistogram';
import StreamSidebar from './components/StreamSidebar';
import LogViewer from './components/LogViewer';
import LoginPage from './components/LoginPage';

import { api } from './lib/api.js';
import { parseQuery, timeRangeToMs, normalizeLogEntry, applyLabelFilters } from './lib/queryParser.js';
import { generateInitialLogs, generateHistogramData, STREAM_FACETS, TIME_RANGES } from './lib/mockData';

// ── URL state helpers ────────────────────────────────────────────────
function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  return {
    query:     p.get('q')       || '{app="nginx", env="prod"} | "error" OR "timeout"',
    timeRange: Number(p.get('minutes')) || 15,
    isLive:    p.get('live')   === '1',
  };
}
function writeUrlState({ query, timeRange, isLive }) {
  const p = new URLSearchParams();
  p.set('q', query);
  p.set('minutes', String(timeRange));
  if (isLive) p.set('live', '1');
  window.history.replaceState({}, '', `?${p.toString()}`);
}

// ── SSE ring-buffer cap ──────────────────────────────────────────────
const SSE_MAX_LINES = 5000;

// ── Error banner ─────────────────────────────────────────────────────
function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  const isEngineDown = error.code === 'ENGINE_ERROR' || error.message?.toLowerCase().includes('502') || error.message?.toLowerCase().includes('grpc');
  return (
    <div style={{
      padding: '7px 16px',
      background: isEngineDown ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
      borderBottom: `1px solid ${isEngineDown ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
      display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke={isEngineDown ? '#f59e0b' : '#f87171'} strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span style={{ fontSize: '11px', color: isEngineDown ? '#f59e0b' : '#f87171', fontFamily: 'JetBrains Mono', flex: 1 }}>
        {isEngineDown
          ? `Go engine offline (gRPC unavailable) — showing demo data. Start the engine or check port 50051.`
          : error.message}
      </span>
      {error.details && (
        <span style={{ fontSize: '10px', color: '#4b5563', fontFamily: 'JetBrains Mono' }}>{error.details}</span>
      )}
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>✕</button>
    </div>
  );
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(() => api.isAuthenticated());

  // ── Core state ────────────────────────────────────────────────────
  const initial = readUrlState();
  const [activeView, setActiveView] = useState('EXPLORE');
  const [query,      setQuery]      = useState(initial.query);
  const [timeRange,  setTimeRange]  = useState(initial.timeRange);
  const [isLive,     setIsLive]     = useState(initial.isLive);
  const [isLoading,  setIsLoading]  = useState(false);
  const [logs,       setLogs]       = useState([]);
  const [histData,   setHistData]   = useState([]);
  const [facets,     setFacets]     = useState(STREAM_FACETS);
  const [newLogCount, setNewLogCount] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);

  // ── Query result meta ─────────────────────────────────────────────
  const [executionTimeNs, setExecutionTimeNs] = useState(0);
  const [dataSource,      setDataSource]      = useState('mock'); // 'engine' | 'mock'
  const [queryError,      setQueryError]      = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────
  const sseRef       = useRef(null);
  const bufferRef    = useRef([]);
  const newCountRef  = useRef(0);

  // ── URL sync ──────────────────────────────────────────────────────
  useEffect(() => {
    writeUrlState({ query, timeRange, isLive });
  }, [query, timeRange, isLive]);

  // ── Real search via GET /api/logs/search ──────────────────────────
  const runQuery = useCallback(async (overrideQuery, overrideTimeRange) => {
    const q  = overrideQuery     ?? query;
    const tr = overrideTimeRange ?? timeRange;

    setIsLoading(true);
    setQueryError(null);
    setNewLogCount(0);
    newCountRef.current = 0;

    // Parse the query bar string
    const parsed = parseQuery(q);
    const { startMs, endMs } = timeRangeToMs(tr);

    try {
      const result = await api.searchLogs({
        term:        parsed.primaryTerm,
        startTimeMs: startMs,
        endTimeMs:   endMs,
        limit:       500,
      });

      // Normalise gRPC LogEntry → display shape, then apply client-side label filters
      const normalized = (result.logs || []).map((e, i) => normalizeLogEntry(e, i));
      const filtered   = applyLabelFilters(normalized, parsed.labels);

      setLogs(filtered);
      setExecutionTimeNs(result.meta?.executionTimeNs ?? 0);
      setDataSource('engine');

      // Refresh histogram from real time range
      setHistData(generateHistogramData(tr, tr > 60 ? 5 : 0.5));

    } catch (err) {
      setQueryError(err);

      if (err.code === 'AUTH_REQUIRED') {
        setIsAuthenticated(false);
        return;
      }

      // Engine unavailable — load mock data so the UI isn't empty
      if (dataSource !== 'engine') {
        const mock = generateInitialLogs(300);
        setLogs(mock);
        setHistData(generateHistogramData(tr, tr > 60 ? 5 : 0.5));
      }
      setDataSource('mock');
      setExecutionTimeNs(0);
    } finally {
      setIsLoading(false);
    }
  }, [query, timeRange, dataSource]);

  // Run initial query when authenticated
  useEffect(() => {
    if (isAuthenticated) runQuery();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Live tail via SSE (EventSource → GET /api/logs/stream) ────────
  useEffect(() => {
    if (!isLive) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      bufferRef.current = [];
      setSseConnected(false);
      return;
    }

    newCountRef.current = 0;
    setNewLogCount(0);
    bufferRef.current = [];

    // Snapshot the query at effect-start time.
    // Do NOT put `query` in the dep array — it would tear down & reconnect
    // SSE on every keystroke while the user is editing the query bar.
    const parsed = parseQuery(query);
    const sseUrl = api.sseUrl(parsed.primaryTerm);

    const es = new EventSource(sseUrl);
    sseRef.current = es;

    // Connection established: HTTP 200 received, stream is open
    es.onopen = () => {
      setSseConnected(true);
      setQueryError(null); // dismiss any previous error banner
    };

    // Default data frame from the server
    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        const isMock = Boolean(entry._mock); // server signals demo mode
        const normalized = {
          id:        entry.id || `sse-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: entry.timestamp_nano
            ? new Date(Math.floor(Number(entry.timestamp_nano) / 1_000_000)).toISOString()
            : entry.timestamp || new Date().toISOString(),
          level:   (entry.level || 'INFO').toUpperCase(),
          host:    entry.host    || 'stream',
          app:     entry.app     || 'sse',
          env:     entry.env     || 'prod',
          message: entry.message || '',
          meta:    entry.meta    || {},
        };
        setDataSource(isMock ? 'mock' : 'engine');
        bufferRef.current.push(normalized);
      } catch (err) {
        console.error('[SSE] parse error:', err);
      }
    };

    // Raw TCP/HTTP connection error (network drop, auth failure, server restart).
    // This is different from named SSE 'error' events — it fires when the
    // EventSource cannot maintain the underlying HTTP connection at all.
    es.onerror = () => {
      setSseConnected(false);
      // CLOSED = browser gave up reconnecting (happens after a non-200 response
      // like 401/403, or after the server deliberately ends the stream).
      if (es.readyState === EventSource.CLOSED) {
        sseRef.current = null;
        setQueryError({
          message: 'SSE stream closed — toggle Live Tail off/on to reconnect.',
          code: 'SSE_CLOSED',
        });
      }
      // CONNECTING = browser is auto-retrying (transient error), do nothing.
    };

    // 350 ms flush: drain accumulated buffer into React state in one batch.
    // Prevents a setState call for every single incoming log line.
    const flushInterval = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0); // atomic drain
      newCountRef.current += batch.length;
      setNewLogCount(newCountRef.current);
      setLogs(prev => {
        const merged = [...batch, ...prev];
        return merged.slice(0, SSE_MAX_LINES); // enforce ring-buffer cap
      });
    }, 350);

    return () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      clearInterval(flushInterval);
      bufferRef.current = [];
      setSseConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]); // query intentionally omitted — snapshotted above

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space')  { e.preventDefault(); setIsLive(v => !v); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Histogram live refresh every 10s
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setHistData(generateHistogramData(timeRange, timeRange > 60 ? 5 : 0.5));
    }, 10_000);
    return () => clearInterval(id);
  }, [isLive, timeRange]);

  // ── Login gate ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => setIsAuthenticated(true)} />;
  }

  const selectedRange = TIME_RANGES.find(r => r.minutes === timeRange) || TIME_RANGES[1];

  return (
    <div style={{
      height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column',
      background: '#0b0f19', overflow: 'hidden',
    }}>
      {/* ── Top Navigation ── */}
      <TopNav
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={() => { api.clearToken(); setIsAuthenticated(false); }}
      />

      {/* ── Page header row ── */}
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid #1e2d3d',
        background: '#0b0f19',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.12em' }}>
          {activeView}
        </h1>

        {sseConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="live-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#06b6d4' }} />
            <span style={{ fontSize: '10px', color: '#06b6d4' }}>SSE Connected</span>
          </div>
        )}

        {/* Parsed query breakdown */}
        {(() => {
          const p = parseQuery(query);
          return p.primaryTerm ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '2px 10px', background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)', borderRadius: '3px',
            }}>
              <span style={{ fontSize: '10px', color: '#4b5563' }}>term:</span>
              <span style={{ fontSize: '10px', color: '#60a5fa', fontFamily: 'JetBrains Mono' }}>
                "{p.primaryTerm}"
              </span>
              {p.labels.length > 0 && (
                <>
                  <span style={{ fontSize: '10px', color: '#374151' }}>·</span>
                  <span style={{ fontSize: '10px', color: '#818cf8', fontFamily: 'JetBrains Mono' }}>
                    {p.labels.map(l => `${l.key}="${l.value}"`).join(', ')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#374151' }}>(client filter)</span>
                </>
              )}
            </div>
          ) : null;
        })()}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#27364b' }}>
            Keyboard: <span style={{ color: '#374151' }}>/</span> focus ·
            <span style={{ color: '#374151' }}> Space</span> live ·
            <span style={{ color: '#374151' }}> Esc</span> blur
          </span>
        </div>
      </div>

      {/* ── Error banner ── */}
      <ErrorBanner error={queryError} onDismiss={() => setQueryError(null)} />

      {/* ── Query Bar ── */}
      <QueryBar
        query={query}
        onQueryChange={setQuery}
        timeRange={timeRange}
        onTimeRangeChange={(m) => { setTimeRange(m); runQuery(query, m); }}
        isLive={isLive}
        onLiveToggle={() => setIsLive(v => !v)}
        onRunQuery={() => runQuery()}
        isLoading={isLoading}
      />

      {/* ── Volume Histogram ── */}
      {histData.length > 0 && (
        <VolumeHistogram data={histData} timeRangeLabel={selectedRange.label} />
      )}

      {/* ── Main Body: Sidebar + Log Table ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <StreamSidebar facets={facets} onFacetsChange={setFacets} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
          <LogViewer
            logs={logs}
            query={query}
            isLoading={isLoading}
            isLive={isLive}
            newLogCount={newLogCount}
            executionTimeNs={executionTimeNs}
            dataSource={dataSource}
          />
        </div>
      </div>
    </div>
  );
}
