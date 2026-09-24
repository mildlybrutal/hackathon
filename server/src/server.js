// server/src/server.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { signToken } from './auth.js';
import { handleSearch, handleStreamSearch } from './controllers/queryController.js';

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// ── Middleware helpers ────────────────────────────────────────────────

/**
 * Standard JWT auth for regular HTTP routes (reads Authorization header).
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * SSE-compatible auth: EventSource cannot set custom headers, so we also
 * accept the JWT as a ?token= query parameter as a fallback.
 */
function requireAuthSse(req, res, next) {
  const headerToken = req.headers['authorization']?.split(' ')[1];
  const queryToken  = req.query.token;
  const raw = headerToken || queryToken;

  if (!raw) {
    return res.status(401).json({ error: 'Auth token required (header or ?token= param)' });
  }
  try {
    req.user = jwt.verify(raw, config.jwtSecret);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth endpoint ─────────────────────────────────────────────────────
// POST /api/auth/login  { username, password } → { token }
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    // Real JWT signed with config.jwtSecret — verifiable by requireAuth
    const token = signToken({ user: 'admin', role: 'engineer' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// ── Log endpoints ─────────────────────────────────────────────────────
// GET /api/logs/search?term=&startTime=&endTime=&limit=
app.get('/api/logs/search', requireAuth, handleSearch);

// GET /api/logs/stream?token=<jwt>&term=  (SSE — token in query param)
app.get('/api/logs/stream', requireAuthSse, handleStreamSearch);

// ── Start ─────────────────────────────────────────────────────────────
const PORT = config.port || 3001;
app.listen(PORT, () => {
  console.log(`[LogShift] Node BFF on http://localhost:${PORT}`);
  console.log(`[LogShift] JWT secret: ${config.jwtSecret.substring(0, 8)}…`);
});