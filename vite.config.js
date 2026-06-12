import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://194.233.79.180:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'http://194.233.79.180:8080');
          });
        },
      },
      '/chat-webhook': {
        target: 'http://194.233.79.180:8081',
        changeOrigin: true,
        rewrite: () => '/api/v1/chat',
      },
      '/intent-sync': {
        target: 'http://194.233.79.180:8081',
        changeOrigin: true,
        rewrite: () => '/api/v1/update',
      },
      '/vector-webhook': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
        rewrite: () => '/webhook/update-intent',
      },
    },
  },
});
