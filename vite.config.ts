import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// ─── Inline plugin: serve docs/ at /docs during dev, copy to dist/docs on build ─

function docsPlugin() {
  const docsDir = path.resolve(process.cwd(), 'docs');

  return {
    name: 'docs-static',

    // Dev: intercept any request under /docs and serve from the docs/ directory
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/docs')) return next();
        const rel = req.url.replace(/^\/docs\/?/, '');
        const filePath = path.join(docsDir, rel || 'getting-started.md');
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mime: Record<string, string> = {
            '.md':   'text/markdown; charset=utf-8',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg':  'image/svg+xml',
          };
          res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    },

    // Build: copy docs/ into dist/docs/ so the deployed app can serve the guide
    closeBundle() {
      const distDocs = path.resolve(process.cwd(), 'dist/docs');
      if (fs.existsSync(docsDir)) {
        fs.cpSync(docsDir, distDocs, { recursive: true });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    docsPlugin(),
  ],
})
