
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname = server/src/services/  →  ../../proto = server/proto/
const PROTO_PATH = path.resolve(__dirname, '../../proto/logservice.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const logengine = protoDescriptor.logengine;

// Dynamic address: TCP on Windows, Unix Domain Socket on Linux
const isWindows = process.platform === 'win32';
const targetAddress = config.grpcTarget || (isWindows ? '127.0.0.1:50051' : `unix://${config.socketPath}`);

export const client = new logengine.LogService(
  targetAddress,
  grpc.credentials.createInsecure()
);

console.log(`[gRPC] Client targeting: ${targetAddress}`);

export function closeClient() {
  client.close();
}
