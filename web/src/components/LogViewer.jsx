// src/components/LogViewer.jsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const LEVEL_BADGE = {
  CRITICAL: 'badge-critical',
  ERROR: 'badge-error',
  WARN: 'badge-warn',
  WARNING: 'badge-warning',
  INFO: 'badge-info',
  DEBUG: 'badge-debug',
  TRACE: 'badge-trace',
};

const ROW_BORDER = {
  CRITICAL: 'log-row-critical',
  ERROR: 'log-row-error',
  WARN: 'log-row-warn',
  WARNING: 'log-row-warn',
  INFO: 'log-row-info',
  DEBUG: 'log-row-debug',
  TRACE: 'log-row-trace',
};

const LEVEL_BG = {
  CRITICAL: 'rgba(239,68,68,0.06)',
  ERROR: 'rgba(239,68,68,0.04)',
  WARN: 'rgba(245,158,11,0.04)',
  WARNING: 'rgba(245,158,11,0.04)',
  INFO: 'transparent',
  DEBUG: 'transparent',
  TRACE: 'transparent',
};

function highlightText(text, query) {
  if (!query || !text) return text;
  // Extract plain text terms from query (ignore label selectors)
  const terms = query
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9_\-.]/gi, ''))
    .filter(t => t.length > 2);

  if (!terms.length) return text;
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="match-highlight">{part}</mark>
      : part
  );
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '—';
  // Compact: 09-24 14:58:12.456Z
  const d = new Date(isoStr);
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${mo}-${dy} ${hh}:${mm}:${ss}.${ms}Z`;
}

function MetaPanel({ meta }) {
  return (
    <div
      className="expand-panel"
      style={{
        background: '#0b1220',
        border: '1px solid #1e2d3d',
        borderRadius: '4px',
        margin: '0 8px 6px 40px',
        padding: '8px 12px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
      }}
    >
      <div style={{ color: '#4b5563', marginBottom: '6px', fontSize: '10px', letterSpacing: '0.06em' }}>
        ▸ STRUCTURED FIELDS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '3px 16px' }}>
        {Object.entries(meta || {}).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ color: '#818cf8', fontWeight: 500 }}>{k}</span>
            <span style={{ color: '#374151' }}>=</span>
            <span style={{ color: '#94a3b8' }}>{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogRow({ log, isExpanded, onToggle, query, isNew }) {
  const borderClass = ROW_BORDER[log.level] || 'log-row-info';
  const bg = LEVEL_BG[log.level] || 'transparent';

  return (
    <div>
      <div
        className={borderClass}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          minHeight: '26px',
          background: isExpanded ? '#131d2e' : (isNew ? 'rgba(6,182,212,0.05)' : bg),
          borderBottom: '1px solid #1a2030',
          cursor: 'pointer',
          transition: 'background 0.1s',
          gap: 0,
        }}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = '#131d2e'; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = bg; }}
        onClick={() => onToggle(log.id)}
      >
        {/* Expand chevron */}
        <div style={{ width: '18px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            width="8" height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isExpanded ? '#06b6d4' : '#374151'}
            strokeWidth="2.5"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* Timestamp */}
        <div style={{
          width: '168px',
          flexShrink: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#4b6a8a',
          paddingRight: '8px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}>
          {formatTimestamp(log.timestamp)}
        </div>

        {/* Severity badge */}
        <div style={{ width: '80px', flexShrink: 0, paddingRight: '8px' }}>
          <span className={`badge ${LEVEL_BADGE[log.level] || 'badge-info'}`}>
            {log.level}
          </span>
        </div>

        {/* Host */}
        <div style={{
          width: '90px',
          flexShrink: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#60a5fa',
          paddingRight: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {log.host}
        </div>

        {/* Message */}
        <div style={{
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#cbd5e1',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {highlightText(log.message, query)}
        </div>

        {/* App tag */}
        <div style={{
          width: '100px',
          flexShrink: 0,
          paddingLeft: '8px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: '#374151',
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {log.app}
        </div>
      </div>

      {/* Expanded meta panel */}
      {isExpanded && <MetaPanel meta={log.meta} />}
    </div>
  );
}

export default function LogViewer({ logs, query, isLoading, isLive, newLogCount, executionTimeNs, dataSource }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const parentRef = useRef(null);

  const estimateSize = useCallback((i) => {
    return expandedIds.has(logs[i]?.id) ? 130 : 27;
  }, [expandedIds, logs]);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 20,
  });

  // Auto-scroll to bottom in live mode
  useEffect(() => {
    if (isLive && autoScroll && logs.length > 0) {
      virtualizer.scrollToIndex(0, { behavior: 'smooth' });
    }
  }, [logs.length, isLive, autoScroll, virtualizer]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Force re-measure
    virtualizer.measure();
  }, [virtualizer]);

  const handleScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    // If user scrolls up, disable auto-scroll
    if (el.scrollTop > 80) setAutoScroll(false);
    else setAutoScroll(true);
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TableHeader />
        <div style={{ flex: 1, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '26px', width: '100%', opacity: 1 - i * 0.04 }} />
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TableHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#27364b" strokeWidth="1.2">
            <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ color: '#374151', fontSize: '13px' }}>No logs found for the current query and time range.</div>
          <div style={{ color: '#27364b', fontSize: '11px' }}>Try broadening your search or adjusting the time window.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <TableHeader />

      {/* New log notification bar */}
      {isLive && !autoScroll && newLogCount > 0 && (
        <div
          style={{
            background: 'rgba(6,182,212,0.1)',
            borderBottom: '1px solid rgba(6,182,212,0.2)',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => {
            virtualizer.scrollToIndex(0);
            setAutoScroll(true);
          }}
        >
          <div className="live-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06b6d4' }} />
          <span style={{ fontSize: '11px', color: '#06b6d4' }}>
            {newLogCount} new log{newLogCount !== 1 ? 's' : ''} — click to scroll to top
          </span>
        </div>
      )}

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
        onScroll={handleScroll}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const log = logs[virtualItem.index];
            if (!log) return null;

            return (
              <div
                key={log.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <LogRow
                  log={log}
                  isExpanded={expandedIds.has(log.id)}
                  onToggle={toggleExpand}
                  query={query}
                  isNew={virtualItem.index < newLogCount}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer status */}
      <div style={{
        borderTop: '1px solid #1e2d3d',
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
        background: '#0b0f19',
      }}>
        <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono' }}>
          {logs.length.toLocaleString()} lines
        </span>

        {/* Data source indicator */}
        {dataSource === 'engine' && (
          <span style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono',
            color: '#34d399',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: '3px', padding: '1px 6px',
          }}>
            ● engine
          </span>
        )}

        {/* Real engine execution time */}
        {executionTimeNs > 0 && (
          <span style={{ fontSize: '10px', color: '#4b5563', fontFamily: 'JetBrains Mono' }}>
            {executionTimeNs < 1_000_000
              ? `${(executionTimeNs / 1000).toFixed(1)} µs`
              : `${(executionTimeNs / 1_000_000).toFixed(2)} ms`
            } query
          </span>
        )}

        {isLive && (
          <>
            <div className="live-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#06b6d4' }} />
            <span style={{ fontSize: '10px', color: '#06b6d4', fontFamily: 'JetBrains Mono' }}>
              Live tail active
            </span>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#27364b' }}>
          Press Space to toggle live tail · Click row to expand
        </span>
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      height: '28px',
      background: '#0d1220',
      borderBottom: '1px solid #1e2d3d',
      flexShrink: 0,
    }}>
      <div style={{ width: '18px', flexShrink: 0 }} />
      <div style={{ width: '168px', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em' }}>
        TIMESTAMP
      </div>
      <div style={{ width: '80px', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em' }}>
        SEVERITY
      </div>
      <div style={{ width: '90px', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em' }}>
        HOST
      </div>
      <div style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em' }}>
        LOG LINE
      </div>
      <div style={{ width: '100px', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#4b5563', letterSpacing: '0.08em', textAlign: 'right' }}>
        APP
      </div>
    </div>
  );
}
