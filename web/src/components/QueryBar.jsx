// src/components/QueryBar.jsx
import { useEffect, useRef, useState } from 'react';
import { TIME_RANGES } from '../lib/mockData';

export default function QueryBar({ query, onQueryChange, timeRange, onTimeRangeChange, isLive, onLiveToggle, onRunQuery, isLoading }) {
  const inputRef = useRef(null);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Keyboard shortcut: / focuses query bar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setShowTimeMenu(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const selectedRange = TIME_RANGES.find(r => r.minutes === timeRange) || TIME_RANGES[1];

  return (
    <div style={{
      background: '#111827',
      borderBottom: '1px solid #1e2d3d',
      padding: '10px 16px',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      {/* Query input */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#4b5563',
          fontSize: '11px',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ color: '#3b82f6' }}>{'{'}</span>
        </div>
        <input
          ref={inputRef}
          id="query-input"
          className="query-input font-mono"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onRunQuery(); }}
          placeholder={`{app="nginx", env="prod"} | "error" OR "timeout"`}
          style={{
            width: '100%',
            background: '#0b0f19',
            border: '1px solid #27364b',
            color: '#e2e8f0',
            padding: '6px 10px 6px 28px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          title="Press / to focus, Enter to run"
        />
        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#374151',
          fontSize: '10px',
          pointerEvents: 'none',
        }}>
          Press / to focus
        </div>
      </div>

      {/* Run Query button */}
      <button
        id="run-query-btn"
        className="btn-primary"
        onClick={onRunQuery}
        disabled={isLoading}
        style={{ minWidth: '100px' }}
      >
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            Running…
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            RUN QUERY
          </span>
        )}
      </button>

      {/* Time range picker */}
      <div style={{ position: 'relative' }}>
        <button
          id="time-range-btn"
          className="btn-ghost"
          onClick={() => setShowTimeMenu(!showTimeMenu)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '130px' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          {selectedRange.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showTimeMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#1a2235',
            border: '1px solid #27364b',
            borderRadius: '6px',
            minWidth: '180px',
            zIndex: 100,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '6px 0' }}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.minutes}
                  onClick={() => { onTimeRangeChange(r.minutes); setShowTimeMenu(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: timeRange === r.minutes ? 'rgba(6,182,212,0.1)' : 'none',
                    border: 'none',
                    color: timeRange === r.minutes ? '#06b6d4' : '#94a3b8',
                    padding: '7px 14px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #27364b', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#4b5563', marginBottom: '4px' }}>Custom UTC Range</div>
              <input
                type="text"
                placeholder="From: 2026-09-24T00:00:00Z"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#0b0f19',
                  border: '1px solid #1e2d3d',
                  color: '#e2e8f0',
                  padding: '4px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginBottom: '4px',
                }}
              />
              <input
                type="text"
                placeholder="To: 2026-09-24T23:59:59Z"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#0b0f19',
                  border: '1px solid #1e2d3d',
                  color: '#e2e8f0',
                  padding: '4px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginBottom: '6px',
                }}
              />
              <button
                className="btn-primary"
                style={{ width: '100%', fontSize: '11px', padding: '4px 8px' }}
                onClick={() => setShowTimeMenu(false)}
              >
                Apply Custom Range
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar icon shortcut */}
      <button className="btn-ghost" style={{ padding: '5px 8px' }} title="Custom date range">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {/* Live Tail toggle */}
      <div
        id="live-tail-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          background: isLive ? 'rgba(6,182,212,0.08)' : '#1a2235',
          border: `1px solid ${isLive ? 'rgba(6,182,212,0.35)' : '#27364b'}`,
          borderRadius: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={onLiveToggle}
        title="Toggle live tailing (Space)"
      >
        {isLive && (
          <div style={{ position: 'relative', width: '8px', height: '8px' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: '#06b6d4',
              opacity: 0.3,
              animation: 'pulse-ring 1.4s infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: '2px',
              borderRadius: '50%',
              background: '#06b6d4',
            }} />
          </div>
        )}
        {!isLive && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#374151' }} />
        )}
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isLive ? '#06b6d4' : '#6b7280',
          letterSpacing: '0.05em',
        }}>
          Live Tail
        </span>
        <label className="toggle" style={{ margin: 0 }}>
          <input type="checkbox" checked={isLive} onChange={onLiveToggle} onClick={e => e.stopPropagation()} />
          <span className="toggle-slider" />
        </label>
      </div>
    </div>
  );
}
