// src/components/LoginPage.jsx
import { useState } from 'react';
import { api } from '../lib/api.js';

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Username and password are required.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', width: '100vw',
      background: '#0b0f19',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Glow blobs */}
      <div style={{
        position: 'absolute', top: '20%', left: '20%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '20%',
        width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 10,
        background: '#111827',
        border: '1px solid #1e2d3d',
        borderRadius: '10px',
        padding: '40px 44px',
        width: '400px',
        boxShadow: '0 32px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(6,182,212,0.06), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
            <svg width="34" height="34" viewBox="0 0 26 26" fill="none">
              <rect width="26" height="26" rx="5" fill="url(#loginLg)" />
              <path d="M7 9h5M7 13h8M7 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="19" cy="9" r="2.5" fill="#06b6d4" opacity="0.9" />
              <defs>
                <linearGradient id="loginLg" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1d4ed8" /><stop offset="1" stopColor="#0891b2" />
                </linearGradient>
              </defs>
            </svg>
            <span style={{ fontWeight: 700, fontSize: '22px', letterSpacing: '0.08em', color: '#e2e8f0' }}>
              LOG<span style={{ color: '#06b6d4' }}>SHIFT</span>
            </span>
          </div>
          <p style={{ color: '#4b5563', fontSize: '12px', letterSpacing: '0.04em' }}>
            High-Performance Real-Time Log Workbench
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{
              display: 'block', color: '#6b7280', fontSize: '10px',
              fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px',
            }}>
              USERNAME
            </label>
            <input
              id="login-username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%', background: '#0b0f19',
                border: '1px solid #27364b', color: '#e2e8f0',
                padding: '9px 12px', borderRadius: '4px', fontSize: '13px',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#06b6d4'}
              onBlur={e => e.target.style.borderColor = '#27364b'}
            />
          </div>

          <div>
            <label style={{
              display: 'block', color: '#6b7280', fontSize: '10px',
              fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px',
            }}>
              PASSWORD
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', background: '#0b0f19',
                border: '1px solid #27364b', color: '#e2e8f0',
                padding: '9px 12px', borderRadius: '4px', fontSize: '13px',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#06b6d4'}
              onBlur={e => e.target.style.borderColor = '#27364b'}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', padding: '8px 12px',
              borderRadius: '4px', fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '11px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', marginTop: '4px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Authenticating…
              </span>
            ) : 'SIGN IN'}
          </button>
        </form>

        {/* Hint */}
        <div style={{
          marginTop: '20px', padding: '10px 14px',
          background: 'rgba(6,182,212,0.04)',
          border: '1px solid rgba(6,182,212,0.12)',
          borderRadius: '4px',
        }}>
          <div style={{ fontSize: '10px', color: '#374151', marginBottom: '5px', letterSpacing: '0.06em' }}>
            DEMO CREDENTIALS
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#4b5563' }}>
            admin <span style={{ color: '#1e2d3d' }}>/</span> admin
          </div>
        </div>

        {/* Architecture note */}
        <div style={{
          marginTop: '12px', fontSize: '10px', color: '#27364b',
          textAlign: 'center', lineHeight: 1.6,
        }}>
          Node BFF → gRPC → Go Engine (LevelDB)
        </div>
      </div>
    </div>
  );
}
