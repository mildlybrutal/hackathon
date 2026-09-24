// src/components/StreamSidebar.jsx
import { useState } from 'react';

const LABEL_COLORS = {
  app: '#818cf8',
  env: '#34d399',
  host: '#60a5fa',
  service: '#f472b6',
};

function FacetItem({ facet, onToggle }) {
  const color = LABEL_COLORS[facet.key] || '#94a3b8';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px 4px 4px',
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1a2235'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      onClick={() => onToggle(facet)}
    >
      {/* Checkbox */}
      <div style={{
        width: '14px',
        height: '14px',
        borderRadius: '3px',
        border: `1px solid ${facet.active ? color : '#27364b'}`,
        background: facet.active ? `${color}22` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}>
        {facet.active && (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Label */}
      <span style={{
        flex: 1,
        fontSize: '11px',
        color: facet.active ? '#e2e8f0' : '#6b7280',
        fontFamily: 'JetBrains Mono, monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color }}>{facet.key}</span>
        <span style={{ color: '#4b5563' }}>=</span>
        <span style={{ color: facet.active ? '#e2e8f0' : '#6b7280' }}>"{facet.value}"</span>
      </span>

      {/* Count */}
      <span style={{
        fontSize: '10px',
        color: facet.active ? color : '#374151',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {facet.count}
      </span>
    </div>
  );
}

export default function StreamSidebar({ facets, onFacetsChange }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = (facet) => {
    onFacetsChange(
      facets.map((f) =>
        f.label === facet.label ? { ...f, active: !f.active } : f
      )
    );
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: '24px',
          background: '#0e1420',
          borderRight: '1px solid #1e2d3d',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={() => setCollapsed(false)}
        title="Expand sidebar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" style={{ marginTop: '4px' }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{
      width: '200px',
      minWidth: '200px',
      background: '#0e1420',
      borderRight: '1px solid #1e2d3d',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid #1e2d3d',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em' }}>
          STREAMS / LABELS
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '2px' }}
          title="Collapse sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Facet groups */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
        {/* App group */}
        <FacetGroup
          label="app"
          items={facets.filter(f => f.key === 'app')}
          onToggle={handleToggle}
          color={LABEL_COLORS.app}
        />
        <FacetGroup
          label="env"
          items={facets.filter(f => f.key === 'env')}
          onToggle={handleToggle}
          color={LABEL_COLORS.env}
        />
        <FacetGroup
          label="host"
          items={facets.filter(f => f.key === 'host')}
          onToggle={handleToggle}
          color={LABEL_COLORS.host}
        />
      </div>

      {/* Active filter count */}
      <div style={{
        padding: '6px 10px',
        borderTop: '1px solid #1e2d3d',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06b6d4' }} />
        <span style={{ fontSize: '10px', color: '#4b5563' }}>
          {facets.filter(f => f.active).length} active filter{facets.filter(f => f.active).length !== 1 ? 's' : ''}
        </span>
        <button
          style={{ marginLeft: 'auto', fontSize: '10px', color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => onFacetsChange(facets.map(f => ({ ...f, active: false })))}
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

function FacetGroup({ label, items, onToggle, color }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: '2px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '4px 4px',
          cursor: 'pointer',
          color: color,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        <svg
          width="10" height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {label.toUpperCase()}
      </button>

      {open && items.map((f) => (
        <FacetItem key={f.label} facet={f} onToggle={onToggle} />
      ))}
    </div>
  );
}
