const { createServer } = require('http');
const next = require('next');
const url = require('url');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

async function start() {
  try {
    console.log('[boot] Starting Next.js app… (dev=%s)', dev);
    await app.prepare();
    const server = createServer((req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[server] Unhandled request error:', err?.stack || err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    server.on('error', (err) => {
      console.error('[server] Listen error:', err?.stack || err);
      process.exit(1);
    });
    server.listen(port, '0.0.0.0', (err) => {
      if (err) { console.error('[server] Failed to start:', err?.stack || err); process.exit(1); }
      console.log(`[server] ✅ Next.js ready on http://0.0.0.0:${port}`);
    });
    const shutdown = (sig) => { console.log(`[server] Received ${sig}, shutting down…`); server.close(() => process.exit(0)); };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (e) {
    console.error('[boot] Failed to prepare Next app:', e?.message || e);
    process.exit(1);
  }
}
start();
