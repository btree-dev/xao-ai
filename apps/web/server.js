import http from 'http';
import { readFileSync, existsSync, statSync, createReadStream } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] || '/';
  let filePath = join(distDir, urlPath);

  // If path is '/', serve index
  // If file doesn't exist (SPA hash routing or direct deep link), fallback to index
  if (urlPath === '/' || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(indexHtml);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  // Basic caching for immutable hashed assets
  if (/assets\\/.+\\.[a-f0-9]{8,}\\.(js|css)$/.test(urlPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
  stream.pipe(res);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('Web app listening on port', port);
});