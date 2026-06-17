import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = resolve(rootDir, 'dist');

function loadEnvFile(filename) {
  const envPath = join(rootDir, filename);
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile('.env.production');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 5173);
const apiTarget = process.env.API_TARGET || 'http://172.16.210.244:8080';
const vectorBackendTarget = process.env.VECTOR_BACKEND_TARGET || 'http://127.0.0.1:8082';
const aiwoEngineTarget = process.env.AIWO_ENGINE_TARGET || 'http://172.16.210.244:8081';
const chatWebhookPath = process.env.CHAT_WEBHOOK_PATH || '/api/v1/chat';
const intentSyncPath = process.env.INTENT_SYNC_PATH || '/api/v1/update';
const vectorWebhookPath = process.env.VECTOR_WEBHOOK_PATH || '/webhook/update-intent';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function cleanHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !hopByHopHeaders.has(key.toLowerCase())));
}

function proxy(req, res, target, rewritePath) {
  const targetUrl = new URL(target);
  const incomingUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  targetUrl.pathname = rewritePath || incomingUrl.pathname;
  targetUrl.search = incomingUrl.search;

  const requestImpl = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const proxyReq = requestImpl({
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers: {
      ...cleanHeaders(req.headers),
      host: targetUrl.host,
      origin: targetUrl.origin,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': 'http',
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, cleanHeaders(proxyRes.headers));
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Proxy request failed', detail: error.message }));
  });

  req.pipe(proxyReq);
}

function resolveStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname.split('?')[0]);
  const safePath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const filePath = resolve(join(distDir, safePath));
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${sep}`)) return null;
  return filePath;
}

async function serveStatic(req, res) {
  const incomingUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let filePath = resolveStaticPath(incomingUrl.pathname);

  if (!filePath || !existsSync(filePath)) filePath = join(distDir, 'index.html');
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
  if (!existsSync(filePath)) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dist/index.html not found. Run npm run build first.');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const headers = {
    'content-type': mimeTypes[ext] || 'application/octet-stream',
  };

  if (filePath.includes(`${sep}assets${sep}`)) {
    headers['cache-control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['cache-control'] = 'no-cache';
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  try {
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  } catch {
    const fallback = await readFile(join(distDir, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fallback);
  }
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api')) {
    proxy(req, res, apiTarget);
    return;
  }

  if (req.url?.startsWith('/chat-webhook')) {
    proxy(req, res, aiwoEngineTarget, chatWebhookPath);
    return;
  }

  if (req.url?.startsWith('/intent-sync')) {
    proxy(req, res, aiwoEngineTarget, intentSyncPath);
    return;
  }

  if (req.url?.startsWith('/vector-webhook')) {
    proxy(req, res, vectorBackendTarget, vectorWebhookPath);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`Intent & Agent Management Console running at http://${host}:${port}`);
  console.log(`Proxy /api -> ${apiTarget}`);
  console.log(`Proxy /chat-webhook -> ${aiwoEngineTarget}${chatWebhookPath}`);
  console.log(`Proxy /intent-sync -> ${aiwoEngineTarget}${intentSyncPath}`);
  console.log(`Proxy /vector-webhook -> ${vectorBackendTarget}${vectorWebhookPath}`);
});
