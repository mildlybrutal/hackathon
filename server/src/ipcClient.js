import net from 'net';
import { config } from './config.js';

export function queryGoEngine(payload) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(config.socketPath);
    let rawData = '';

    client.on('connect', () => {
      // Send parameters newline-delimited to make Go scanner/decoder happy
      client.write(JSON.stringify(payload) + '\n');
    });

    client.on('data', (chunk) => {
      rawData += chunk.toString();
    });

    client.on('end', () => {
      if (!rawData.trim()) {
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(rawData);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse response from Go engine: ${err.message}`));
      }
    });

    client.on('error', (err) => {
      reject(new Error(`Socket connection failed (${config.socketPath}): ${err.message}`));
    });

    // Guard against hanging requests
    client.setTimeout(4000, () => {
      client.destroy();
      reject(new Error('Go database engine query timed out'));
    });
  });
}