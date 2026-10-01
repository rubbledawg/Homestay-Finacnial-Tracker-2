import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  if (!['127.0.0.1:4317', 'localhost:4317'].includes(req.headers.host)) { res.writeHead(403).end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1:4317').pathname);
    const file = path.resolve(root, '.' + (urlPath === '/' ? '/index.html' : urlPath));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'The local app is already open, or port 4317 is in use.' : error.message); process.exitCode = 1; });
server.listen(4317, '127.0.0.1', () => {
  console.log('Airbnb Ledger: http://127.0.0.1:4317 — leave this window open while using the app.');
  if (process.argv.includes('--open')) execFile('cmd.exe', ['/c', 'start', '', 'http://127.0.0.1:4317'], { windowsHide: true });
});
