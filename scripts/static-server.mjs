// Dependency-free local HTTP server for WebStorm and browser QA.
// Browser ES modules, JSON modules and textures do not run reliably over file://.
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic({ host = '127.0.0.1', port = 4185 } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filePath = path.resolve(ROOT, '.' + pathname);
      if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
      const data = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 400).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

// `node scripts/static-server.mjs` runs without `npm install`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  await serveStatic({ port });
  console.log(`Battle Atelier: http://127.0.0.1:${port}/`);
}
