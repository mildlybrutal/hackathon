// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

import TopNav from './components/TopNav';
import QueryBar from './components/QueryBar';
import VolumeHistogram from './components/VolumeHistogram';
import StreamSidebar from './components/StreamSidebar';
import LogViewer from './components/LogViewer';
import {
  generateInitialLogs,
  generateLog,
  generateHistogramData,
  STREAM_FACETS,
  TIME_RANGES,
} from './lib/mockData';

// ── URL state helpers ────────────────────────────────────────────────
function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  return {
    query: p.get('q') || '{app="nginx", env="prod"} | "error" OR "timeout"',
    timeRange: Number(p.get('minutes')) || 15,
    isLive: p.get('live') === '1',
  };
}

function writeUrlState({ query, timeRange, isLive }) {
  const p = new URLSearchParams();
  p.set('q', query);
  p.set('minutes', timeRange);
  if (isLive) p.set('live', '1');
  window.history.replaceState({}, '', `?${p.toString()}`);
}

// ── Ring buffer for live tail (max 2000 entries) ─────────────────────
const RING_MAX = 2000;

function addToRingBuffer(existing, newLogs) {
  const combined = [...newLogs, ...existing];
  return combined.slice(0, RING_MAX);
}

export default function App() {
  const initial = readUrlState();
  const [activeView, setActiveView] = useState('EXPLORE');
  const [query, setQuery] = useState(initial.query);
  const [timeRange, setTimeRange] = useState(initial.timeRange);
  const [isLive, setIsLive] = useState(initial.isLive);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [histData, setHistData] = useState([]);
  const [facets, setFacets] = useState(STREAM_FACETS);
  const [newLogCount, setNewLogCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const newCountRef = useRef(0);

  // ── Sync URL on state change ─────────────────────────────────────
  useEffect(() => {
    writeUrlState({ query, timeRange, isLive });
  }, [query, timeRange, isLive]);

  // ── Initial load simulation ──────────────────────────────────────
  const runQuery = useCallback(async () => {
    setIsLoading(true);
    setNewLogCount(0);
    newCountRef.current = 0;

    // Simulate network latency
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

    const initial = generateInitialLogs(300);
    setLogs(initial);
    setHistData(generateHistogramData(timeRange, timeRange > 60 ? 5 : 0.5));
    setIsLoading(false);
  }, [timeRange]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  // ── Live tail via WebSocket (real) + mock fallback ───────────────
  useEffect(() => {
    if (!isLive) {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    // Try real WebSocket
    let ws;
    try {
      ws = new WebSocket('ws://localhost:3001/ws/logs');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        // Fallback to mock if server unavailable
        startMockLive();
      };
      ws.onerror = () => {
        ws.close();
        startMockLive();
      };
      ws.onmessage = (e) => {
        try {
          const log = JSON.parse(e.data);
          const normalized = {
            id: log.id || `ws-${Date.now()}`,
            timestamp: log.timestampNs
              ? new Date(Math.floor(log.timestampNs / 1_000_000)).toISOString()
              : new Date().toISOString(),
            level: log.level || 'INFO',
            host: log.host || 'ws-host',
            app: log.app || 'stream',
            env: 'prod',
            message: log.message || '',
            meta: log.meta || {},
          };

          setLogs(prev => addToRingBuffer(prev, [normalized]));
          newCountRef.current += 1;
          setNewLogCount(newCountRef.current);
        } catch (_) { /* ignore parse errors */ }
      };
      wsRef.current = ws;
    } catch (_) {
      startMockLive();
    }

    function startMockLive() {
      if (liveIntervalRef.current) return; // already running
      liveIntervalRef.current = setInterval(() => {
        const count = Math.floor(Math.random() * 3) + 1;
        const newLogs = Array.from({ length: count }, () => generateLog());
        setLogs(prev => addToRingBuffer(prev, newLogs));
        newCountRef.current += count;
        setNewLogCount(c => c + count);
      }, 300);
    }

    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
    };
  }, [isLive]);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Space = toggle live tail (when not focused on input)
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsLive(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Histogram refreshes every 10s in live mode
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setHistData(generateHistogramData(timeRange, timeRange > 60 ? 5 : 0.5));
    }, 10_000);
    return () => clearInterval(id);
  }, [isLive, timeRange]);

  const selectedRange = TIME_RANGES.find(r => r.minutes === timeRange) || TIME_RANGES[1];

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: '#0b0f19',
      overflow: 'hidden',
    }}>
      {/* ── Top Navigation ── */}
      <TopNav activeView={activeView} onViewChange={setActiveView} />

      {/* ── Page title row ── */}
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid #1e2d3d',
        background: '#0b0f19',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.12em' }}>
          {activeView}
        </h1>
        {wsConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="live-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#06b6d4' }} />
            <span style={{ fontSize: '10px', color: '#06b6d4' }}>WS Connected</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#27364b' }}>
            Keyboard: <span style={{ color: '#374151' }}>/</span> focus query ·
            <span style={{ color: '#374151' }}> Space</span> live tail ·
            <span style={{ color: '#374151' }}> Esc</span> clear
          </span>
        </div>
      </div>

      {/* ── Query Bar ── */}
      <QueryBar
        query={query}
        onQueryChange={setQuery}
        timeRange={timeRange}
        onTimeRangeChange={(m) => { setTimeRange(m); }}
        isLive={isLive}
        onLiveToggle={() => setIsLive(v => !v)}
        onRunQuery={runQuery}
        isLoading={isLoading}
      />

      {/* ── Volume Histogram ── */}
      {histData.length > 0 && (
        <VolumeHistogram
          data={histData}
          timeRangeLabel={selectedRange.label}
        />
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
          />
        </div>
      </div>
    </div>
  );
}
