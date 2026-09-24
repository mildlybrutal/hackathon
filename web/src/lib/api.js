// src/lib/api.js
// Typed API client for the LogShift Node BFF
// All paths go through Vite's /api proxy → http://localhost:3001

const TOKEN_KEY = 'logshift_token';

export const api = {
  // ── Token helpers ──────────────────────────────────────────────
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  setToken(t) { localStorage.setItem(TOKEN_KEY, t); },
  clearToken() { localStorage.removeItem(TOKEN_KEY); },
  isAuthenticated() { return Boolean(localStorage.getItem(TOKEN_KEY)); },

  // ── Auth ───────────────────────────────────────────────────────
  /** POST /api/auth/login → { token } */
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Login failed (${res.status})`);
    this.setToken(body.token);
    return body.token;
  },

  // ── Search ─────────────────────────────────────────────────────
  /**
   * GET /api/logs/search
   *   ?term=error
   *   &startTime=<epoch_ms>
   *   &endTime=<epoch_ms>
   *   &limit=200
   *
   * Returns: { meta: { count, executionTimeNs }, logs: [LogEntry] }
   * LogEntry (from proto): { timestamp_nano: string, message: string }
   */
  async searchLogs({ term = '', startTimeMs, endTimeMs, limit = 200 }) {
    const params = new URLSearchParams({
      term,
      startTime: Math.floor(startTimeMs),
      endTime:   Math.floor(endTimeMs),
      limit,
    });

    const token = this.getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await fetch(`/api/logs/search?${params}`, { headers });

    if (res.status === 401 || res.status === 403) {
      this.clearToken();
      const err = new Error('Session expired. Please log in again.');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `Server returned ${res.status}`);
      err.code = 'ENGINE_ERROR';
      err.details = body.details;
      throw err;
    }
    return body; // { meta, logs }
  },

  /**
   * Build an EventSource URL for the SSE live-tail stream.
   * Includes the JWT as ?token= because EventSource cannot set
   * custom Authorization headers — the server's requireAuthSse
   * middleware reads it from the query string.
   */
  sseUrl(term = '') {
    const params = new URLSearchParams({ term });
    const token = this.getToken();
    if (token) params.set('token', token);
    return `/api/logs/stream?${params}`;
  },
};
