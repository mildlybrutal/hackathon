import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleSearch } from './controllers/queryController.js';
import { closeClient } from './services/logClient.js';
import { createLiveTail } from './services/liveTail.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/logs/search', handleSearch);

const server = http.createServer(app);
const wsServer = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws/logs') return socket.destroy();
  wsServer.handleUpgrade(request, socket, head, (ws) => wsServer.emit('connection', ws, request));
});

wsServer.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const tail = createLiveTail(ws, {
    term: url.searchParams.get('term') || '',
    pollMs: config.livePollMs,
  });
  ws.on('close', tail.stop);
  ws.on('error', tail.stop);
});

const listener = server.listen(config.port, () => {
  console.log(`[Chronolog] Node BFF on http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`[Chronolog] ${signal}: shutting down`);
  wsServer.clients.forEach((ws) => ws.close(1001, 'server shutting down'));
  server.close(() => closeClient());
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export { app, listener, wsServer };
