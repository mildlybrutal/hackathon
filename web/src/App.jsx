// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

import QueryBar from './components/QueryBar';
import LogViewer from './components/LogViewer';

import { api } from './lib/api.js';
import { parseQuery, timeRangeToMs, normalizeLogEntry, applyLabelFilters } from './lib/queryParser.js';

// ── URL state helpers ────────────────────────────────────────────────
function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  return {
    query:     p.get('q')       || 'timeout',
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

const LIVE_MAX_LINES = 5000;

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
          ? `Go engine unavailable — start the Go engine and verify the gRPC socket.`
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
  // ── Core state ────────────────────────────────────────────────────
  const initial = readUrlState();
  const [query,      setQuery]      = useState(initial.query);
  const [timeRange,  setTimeRange]  = useState(initial.timeRange);
  const [isLive,     setIsLive]     = useState(initial.isLive);
  const [isLoading,  setIsLoading]  = useState(false);
  const [logs,       setLogs]       = useState([]);
  const [newLogCount, setNewLogCount] = useState(0);
  const [socketState, setSocketState] = useState('off');

  // ── Query result meta ─────────────────────────────────────────────
  const [executionTimeNs, setExecutionTimeNs] = useState(0);
  const [dataSource,      setDataSource]      = useState('engine');
  const [queryError,      setQueryError]      = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────
  const socketRef    = useRef(null);
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

    } catch (err) {
      setQueryError(err);

      setLogs([]);
      setDataSource('engine');
      setExecutionTimeNs(0);
    } finally {
      setIsLoading(false);
    }
  }, [query, timeRange]);

  // Run initial query on mount
  useEffect(() => {
    runQuery();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live tail via WebSocket ───────────────────────────────────────
  useEffect(() => {
    if (!isLive) {
      if (socketRef.current) { socketRef.current.close(1000, 'live tail disabled'); socketRef.current = null; }
      bufferRef.current = [];
      setSocketState('off');
      return;
    }

    newCountRef.current = 0;
    setNewLogCount(0);
    bufferRef.current = [];

    const parsed = parseQuery(query);
    let stopped = false;
    let reconnectTimer;
    let ws;
    const connect = () => {
      if (stopped) return;
      setSocketState('connecting');
      ws = new WebSocket(api.websocketUrl(parsed.primaryTerm));
      socketRef.current = ws;
      ws.onopen = () => setSocketState('connected');
      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'status') { setSocketState(packet.state); return; }
          if (packet.type === 'error') { setSocketState('error'); setQueryError({ code: 'STREAM_ERROR', message: packet.error }); return; }
          if (packet.type !== 'log') return;
          const entry = packet.log || {};
          const normalized = normalizeLogEntry({ ...entry, timestamp_nano: entry.timestamp_nano || String(Date.now() * 1e6) }, Date.now());
          setDataSource('engine');
          bufferRef.current.push(normalized);
        } catch (err) { console.error('[WebSocket] parse error:', err); }
      };
      ws.onerror = () => setSocketState('error');
      ws.onclose = () => {
        if (socketRef.current === ws) socketRef.current = null;
        if (!stopped) reconnectTimer = setTimeout(connect, 1000);
      };
    };
    connect();

    // 350 ms flush: drain accumulated buffer into React state in one batch.
    // Prevents a setState call for every single incoming log line.
    const flushInterval = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0); // atomic drain
      newCountRef.current += batch.length;
      setNewLogCount(newCountRef.current);
      setLogs(prev => {
        const merged = [...batch, ...prev];
        return merged.slice(0, LIVE_MAX_LINES);
      });
    }, 350);

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      const current = socketRef.current;
      if (current) {
        if (current.readyState === WebSocket.CONNECTING) {
          current.onopen = () => current.close(1000, 'live tail disabled');
          current.onmessage = null;
          current.onerror = null;
        } else {
          current.close(1000, 'live tail disabled');
        }
        socketRef.current = null;
      }
      clearInterval(flushInterval);
      bufferRef.current = [];
      setSocketState('off');
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

  return (
    <div style={{
      height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column',
      background: '#0b0f19', overflow: 'hidden',
    }}>
      {/* ── Connection/status row ── */}
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid #1e2d3d',
        background: '#0b0f19',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.12em' }}>
          CHRONOLOG
        </h1>

        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="live-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#06b6d4' }} />
            <span style={{ fontSize: '10px', color: socketState === 'connected' ? '#22c55e' : '#f59e0b' }}>Live tail {socketState}</span>
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
        onLiveToggle={() => { setIsLive(v => !v); runQuery(); }}
        onRunQuery={() => runQuery()}
        isLoading={isLoading}
      />

      {/* ── Log table ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
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
