import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubRepoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = githubRepoName ? `/${githubRepoName}/` : '/';
const defaultProdBase = process.env.GITHUB_ACTIONS ? githubPagesBase : '/';

const devCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' http://localhost:* http://127.0.0.1:*",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
].join('; ');

const prodCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
].join('; ');

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? defaultProdBase,
  plugins: [
    react(),
    {
      name: 'inject-csp',
      transformIndexHtml(html) {
        const csp = command === 'serve' ? devCsp : prodCsp;
        return html.replace('__CSP_CONTENT__', csp);
      },
    },
    {
      name: 'ip-logger',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const xff = req.headers['x-forwarded-for'];
          const ip =
            (typeof xff === 'string' && xff.split(',')[0]?.trim()) ||
            req.socket.remoteAddress ||
            'unknown';
          const url = req.url || '-';
          console.log(`[ip] ${ip} ${req.method} ${url}`);
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: process.env.VITE_DEV_HOST ?? '127.0.0.1',
  },
}));
