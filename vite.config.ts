import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages project sites are served from /<repo>/, not /
  base: process.env.VITE_BASE_PATH ?? (mode === 'production' ? '/bioinfo-site/' : '/'),
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
    host: true,
  },
}));
