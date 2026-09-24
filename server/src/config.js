// server/src/config.js
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  socketPath: process.env.GO_SOCKET_PATH || '/tmp/log_engine.sock',
  grpcTarget: process.env.GRPC_TARGET || '',
  livePollMs: Number(process.env.LIVE_POLL_MS || 400),
};
