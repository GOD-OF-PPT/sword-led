import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const pages = new Set(['/tests/browser/fixture.html', '/tests/browser/fixture.js', '/tests/browser/away.html']);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1:4178').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const file = resolve(root, `.${pathname}`);
  const inDist = pathname.startsWith('/dist/') && file.startsWith(`${resolve(root, 'dist')}/`) && file.endsWith('.js');
  if ((request.method !== 'GET' && request.method !== 'HEAD') || (!pages.has(pathname) && !inDist)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(4178, '127.0.0.1');
server.on('error', () => { process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
