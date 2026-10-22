// Temporary upload receiver for the 微光指引 trial host.
//
// Runs ON the ECS host, listens on 127.0.0.1 only, and is reachable from the public site only
// through a temporary IIS rewrite rule added (and removed) by infra/windows/tools/push-downloads.mjs.
// Requires a random per-run token header, refuses path traversal, streams the body to disk and
// returns the size plus SHA-256 so the caller can verify the transfer.
//
// Usage on host: node upload-receiver.mjs <uploadDir> <tokenFile> [port]

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const uploadDir = process.argv[2];
const tokenFile = process.argv[3];
const port = Number.parseInt(process.argv[4] ?? '3999', 10);

if (!uploadDir || !tokenFile) {
  console.error('usage: node upload-receiver.mjs <uploadDir> <tokenFile> [port]');
  process.exit(2);
}
const token = fs.readFileSync(tokenFile, 'utf8').trim();
if (token.length < 32) {
  console.error('token too short');
  process.exit(2);
}
fs.mkdirSync(uploadDir, { recursive: true });

function safeName(raw) {
  const decoded = decodeURIComponent(raw);
  if (!decoded || decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) return null;
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(decoded)) return null;
  return decoded;
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/_ping') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('pong');
    return;
  }
  if (request.method !== 'POST' || !request.url.startsWith('/_upload/')) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }
  if (request.headers['x-upload-token'] !== token) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('forbidden');
    return;
  }
  const name = safeName(request.url.slice('/_upload/'.length));
  if (!name) {
    response.writeHead(400, { 'content-type': 'text/plain' });
    response.end('bad name');
    return;
  }
  const destination = path.join(uploadDir, name);
  const hash = crypto.createHash('sha256');
  let size = 0;
  const stream = fs.createWriteStream(destination);
  request.on('data', (chunk) => {
    hash.update(chunk);
    size += chunk.length;
  });
  request.on('error', () => stream.destroy());
  stream.on('error', (error) => {
    console.error('write failed', error.message);
    if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' });
    response.end('write failed');
  });
  stream.on('finish', () => {
    const sha256 = hash.digest('hex');
    console.log(`${name} ${size} ${sha256}`);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ name, size, sha256 }));
  });
  request.pipe(stream);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`upload receiver listening on 127.0.0.1:${port}, dir=${uploadDir}`);
});
