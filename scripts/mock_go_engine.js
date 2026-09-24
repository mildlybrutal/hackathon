// scripts/mock_go_engine.js
import net from 'net';
import protobuf from 'protobufjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = await protobuf.load(path.resolve(__dirname, '../server/logquery.proto'));
const QueryRequest = root.lookupType('logengine.QueryRequest');
const QueryResponse = root.lookupType('logengine.QueryResponse');

const server = net.createServer((socket) => {
  let chunks = [];
  let expectedLen = null;

  socket.on('data', (chunk) => {
    chunks.push(chunk);
    const buf = Buffer.concat(chunks);

    if (expectedLen === null && buf.length >= 4) {
      expectedLen = buf.readUInt32BE(0);
    }

    if (expectedLen !== null && buf.length >= 4 + expectedLen) {
      const msgBytes = buf.subarray(4, 4 + expectedLen);
      const req = QueryRequest.decode(msgBytes);
      console.log('Received query over TCP:', req);

      const responsePayload = {
        logs: [
          {
            id: 'log-101',
            timestampNs: Date.now() * 1e6,
            level: 'ERROR',
            message: `Sample timeout error matching token: ${req.token || 'ALL'}`
          },
          {
            id: 'log-102',
            timestampNs: Date.now() * 1e6 + 500000,
            level: 'INFO',
            message: 'Database connection recovered.'
          }
        ],
        executionTimeNs: 85000,
        errorMessage: ''
      };

      const respBytes = QueryResponse.encode(QueryResponse.create(responsePayload)).finish();
      const frame = Buffer.allocUnsafe(4 + respBytes.length);
      frame.writeUInt32BE(respBytes.length, 0);
      respBytes.copy(frame, 4);

      socket.write(frame);
      socket.end();
    }
  });
});

server.listen(50051, '127.0.0.1', () => {
  console.log('Mock Go Engine running on TCP 127.0.0.1:50051');
});