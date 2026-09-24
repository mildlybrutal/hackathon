import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { signToken, requireAuth } from './auth.js';
import { queryGoEngine } from './ipcClient.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/logs' });

// Active WebSocket client connections for real-time live tailing
const connectedClients = new Set();
wss.on('connection', (ws) => {
  connectedClients.add(ws);
  ws.on('close', () => connectedClients.delete(ws));
});

// 1. Auth Login (Hackathon admin credentials)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    const token = signToken({ user: 'admin', role: 'engineer' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

// 2. Query Search Proxy Route
app.get('/api/logs/search', requireAuth, async (req, res) => {
  const { token, start, end, limit } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Query parameter "token" is required' });
  }

  const queryPayload = {
    action: 'SEARCH',
    token: String(token),
    start: Number(start) || 0,
    end: Number(end) || Date.now() * 1e6, // default to now (nanoseconds)
    limit: Number(limit) || 100
  };

  try {
    const results = await queryGoEngine(queryPayload);
    res.json({ count: results.length, data: results });
  } catch (err) {
    console.error('[IPC Error]', err.message);
    res.status(502).json({ error: 'Storage engine unavailable', details: err.message });
  }
});

// 3. Ingestion Hook (Go can push newly ingested logs here to broadcast to UI)
app.post('/internal/stream', (req, res) => {
  const payload = JSON.stringify(req.body);
  for (const client of connectedClients) {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(payload);
    }
  }
  res.sendStatus(204);
});

// Simulate real-time logs arriving every 100ms
setInterval(() => {
  if (connectedClients.size === 0) return;
  const sampleLog = JSON.stringify({
    id: `live-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestampNs: Date.now() * 1e6,
    level: Math.random() > 0.8 ? 'ERROR' : 'INFO',
    message: `Synthetic stream tick: system health OK [load=${(Math.random() * 2).toFixed(2)}]`
  });

  for (const client of connectedClients) {
    if (client.readyState === 1) client.send(sampleLog);
  }
}, 100);

server.listen(config.port, () => {
  console.log(`Node proxy service running on http://localhost:${config.port}`);
});