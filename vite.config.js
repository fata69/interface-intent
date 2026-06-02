import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://172.16.210.244:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'http://172.16.210.244:8080');
          });
        },
      },
      '/chat-webhook': {
        target: 'http://172.16.210.244:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat',
      },
      '/vector-webhook': {
        target: 'http://172.16.210.244:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/update-intent',
      },
    },
  },
});
