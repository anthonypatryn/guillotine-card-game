import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { makeStore, handleBugs } from './lib/bugs.js';

// Dev-only: serve /api/bugs with a local file store so the bug form works in dev.
function bugsApi() {
  return {
    name: 'bugs-api',
    configureServer(server) {
      server.middlewares.use('/api/bugs', async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try {
          const body = raw ? JSON.parse(raw) : {};
          const pin = process.env.BUG_PIN || '1327'; // local default
          const [status, json] = await handleBugs(makeStore(path.resolve('.data')), req.method, body, req.headers['x-bug-pin'], pin);
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(json));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), bugsApi()],
});
