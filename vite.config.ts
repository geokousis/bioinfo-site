import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubRepoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = githubRepoName ? `/${githubRepoName}/` : '/';
const defaultProdBase = process.env.GITHUB_ACTIONS ? githubPagesBase : '/';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: process.env.VITE_BASE_PATH ?? defaultProdBase,
  plugins: [
    react(),
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
