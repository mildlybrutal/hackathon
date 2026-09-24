// server/src/config.js
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'hackathon_secret_2026',
  useTcp: true, // Directly connect via TCP on Windows
  tcpHost: '127.0.0.1',
  tcpPort: 50051,
  socketPath: process.env.GO_SOCKET_PATH || '/tmp/logengine.sock',
};