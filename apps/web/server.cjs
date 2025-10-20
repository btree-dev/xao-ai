// CommonJS version of static file server to avoid ESM loader issues under PM2
const http = require('http');
const { readFileSync, existsSync, statSync, createReadStream } = require('fs');
const { extname, join } = require('path');

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

let indexHtml = '';
try {
  indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');
} catch (e) {
  console.error('Could not read dist/index.html. Did you run the build?');
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const filePath = join(distDir, urlPath);
  if (urlPath === '/' || !existsSync(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(indexHtml || '<h1>Build missing</h1>');
  }
  const ext = extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  if (/assets\/.+\.[a-f0-9]{8,}\.(js|css)$/.test(urlPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => { res.statusCode = 500; res.end('Internal Server Error'); });
  stream.pipe(res);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('Perf web (CJS) listening on port', port);
});
