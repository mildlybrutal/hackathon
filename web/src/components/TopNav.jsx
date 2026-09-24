// src/components/TopNav.jsx
import { useState } from 'react';

const NAV_ITEMS = ['DASHBOARD', 'EXPLORE', 'ALERTS', 'ADMIN'];

export default function TopNav({ activeView, onViewChange, onLogout }) {
  const [tenant, setTenant] = useState('Default');

  return (
    <header
      style={{
        background: 'linear-gradient(180deg, #0d1320 0%, #0b0f19 100%)',
        borderBottom: '1px solid #1e2d3d',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '24px',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect width="26" height="26" rx="5" fill="url(#lg1)" />
          <path d="M7 9h5M7 13h8M7 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="19" cy="9" r="2.5" fill="#06b6d4" opacity="0.9" />
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1d4ed8" />
              <stop offset="1" stopColor="#0891b2" />
            </linearGradient>
          </defs>
        </svg>
        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.08em', color: '#e2e8f0' }}>
          LOG<span style={{ color: '#06b6d4' }}>SHIFT</span>
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            onClick={() => onViewChange(item)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 14px',
              height: '44px',
              color: activeView === item ? '#e2e8f0' : '#6b7280',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              borderBottom: activeView === item ? '2px solid #06b6d4' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (activeView !== item) e.target.style.color = '#94a3b8'; }}
            onMouseLeave={(e) => { if (activeView !== item) e.target.style.color = '#6b7280'; }}
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Tenant selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#4b5563', fontSize: '11px' }}>Tenant:</span>
          <select
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            style={{
              background: '#1a2235',
              border: '1px solid #27364b',
              color: '#94a3b8',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option>Default</option>
            <option>Acme Corp</option>
            <option>Internal</option>
          </select>
        </div>

        {/* Environment badge */}
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          color: '#34d399',
          fontSize: '10px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '3px',
          letterSpacing: '0.06em',
        }}>
          PROD
        </div>

        {/* User icon */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
          title="User Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>

        {/* Logout */}
        {onLogout && (
          <button
            id="logout-btn"
            onClick={onLogout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        )}

        {/* Settings icon */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
          title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
