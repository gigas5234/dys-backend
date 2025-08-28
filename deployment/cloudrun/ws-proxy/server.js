'use strict';

// Simple WebSocket reverse proxy for Cloud Run
// - Terminates TLS at Cloud Run (wss)
// - Proxies /ws/* to TARGET_BASE (e.g., http://34.64.136.237:8001)

const http = require('http');
const httpProxy = require('http-proxy');

const PORT = process.env.PORT || 8080;
const TARGET_BASE = process.env.TARGET_BASE || 'http://34.64.136.237:8001';

// Create reusable proxy instance
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: false, // allow self-signed if any (backend is http)
  timeout: 60000,
  proxyTimeout: 60000,
});

proxy.on('error', (err, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
  }
  try {
    const msg = JSON.stringify({ ok: false, error: 'proxy_error', message: err.message });
    res && res.end(msg);
  } catch (_) {
    // ignore
  }
});

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/ws')) {
    // HTTP fallback (in case someone hits via HTTP)
    const target = TARGET_BASE + req.url;
    proxy.web(req, res, { target });
    return;
  }

  // Health check and info
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'ws-proxy', target: TARGET_BASE }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

// Handle WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/ws')) {
    const target = TARGET_BASE + req.url;
    proxy.ws(req, socket, head, { target });
  } else {
    socket.destroy();
  }
});

// Cloud Run idle/keepalive tuning
server.headersTimeout = 65_000;
server.requestTimeout = 0; // disable per-request timeout (Cloud Run still enforces overall)

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ws-proxy listening on :${PORT} → ${TARGET_BASE}`);
});


