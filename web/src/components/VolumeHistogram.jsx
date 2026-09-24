// src/components/VolumeHistogram.jsx
import { useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, Cell,
} from 'recharts';

const COLORS = {
  critical: '#ef4444',
  error: '#f87171',
  warn: '#f59e0b',
  info: '#10b981',
  debug: '#60a5fa',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: '#1a2235',
      border: '1px solid #27364b',
      borderRadius: '6px',
      padding: '8px 12px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono, monospace',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
          <span style={{ color: COLORS[p.dataKey] }}>{p.dataKey}</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.value?.toLocaleString()}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #27364b', marginTop: '6px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#6b7280' }}>total</span>
        <span style={{ color: '#06b6d4', fontWeight: 700 }}>{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default function VolumeHistogram({ data, timeRangeLabel }) {
  const [brushStart, setBrushStart] = useState(null);
  const [brushEnd, setBrushEnd] = useState(null);
  const [isBrushing, setIsBrushing] = useState(false);
  const [selection, setSelection] = useState(null);

  const totalLogs = data.reduce((s, d) => s + d.critical + d.error + d.warn + d.info + d.debug, 0);
  const rate = Math.round(totalLogs / ((data.length * 0.5) * 60));

  const handleMouseDown = useCallback((e) => {
    if (e && e.activeLabel) {
      setBrushStart(e.activeLabel);
      setBrushEnd(null);
      setIsBrushing(true);
      setSelection(null);
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isBrushing && e && e.activeLabel) {
      setBrushEnd(e.activeLabel);
    }
  }, [isBrushing]);

  const handleMouseUp = useCallback(() => {
    if (brushStart && brushEnd) {
      setSelection({ from: brushStart, to: brushEnd });
    }
    setIsBrushing(false);
  }, [brushStart, brushEnd]);

  const clearSelection = () => {
    setSelection(null);
    setBrushStart(null);
    setBrushEnd(null);
  };

  return (
    <div style={{
      background: '#0e1420',
      borderBottom: '1px solid #1e2d3d',
      padding: '10px 16px 6px',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em' }}>
          LOG VOLUME
        </span>
        <span style={{ fontSize: '10px', color: '#4b5563' }}>
          ({timeRangeLabel}, {(totalLogs / 1000).toFixed(1)}k logs, ~{rate.toLocaleString()} logs/sec)
        </span>

        {selection && (
          <button
            onClick={clearSelection}
            style={{
              marginLeft: 'auto',
              background: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.3)',
              color: '#06b6d4',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            ✕ Clear zoom
          </button>
        )}

        {/* Legend */}
        <div style={{ marginLeft: selection ? '0' : 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {Object.entries(COLORS).map(([key, color]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
              <span style={{ fontSize: '10px', color: '#6b7280' }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: '100px', cursor: isBrushing ? 'col-resize' : 'crosshair' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 2, right: 0, left: -28, bottom: 0 }}
            barCategoryGap="10%"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <XAxis
              dataKey="time"
              tick={{ fill: '#374151', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#1e2d3d' }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              tick={{ fill: '#374151', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

            {/* Brush selection area */}
            {brushStart && brushEnd && (
              <ReferenceArea
                x1={brushStart}
                x2={brushEnd}
                fill="rgba(6,182,212,0.12)"
                stroke="rgba(6,182,212,0.4)"
                strokeWidth={1}
              />
            )}

            <Bar dataKey="critical" stackId="a" fill={COLORS.critical} maxBarSize={20} />
            <Bar dataKey="error" stackId="a" fill={COLORS.error} maxBarSize={20} />
            <Bar dataKey="warn" stackId="a" fill={COLORS.warn} maxBarSize={20} />
            <Bar dataKey="info" stackId="a" fill={COLORS.info} maxBarSize={20} />
            <Bar dataKey="debug" stackId="a" fill={COLORS.debug} radius={[2, 2, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selection && (
        <div style={{
          fontSize: '10px',
          color: '#06b6d4',
          marginTop: '2px',
          fontFamily: 'JetBrains Mono',
        }}>
          Zoom: {selection.from} → {selection.to}
        </div>
      )}
    </div>
  );
}
