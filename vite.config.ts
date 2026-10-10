import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Renderer build. Electron loads dist/index.html via file://, hence base './'.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  json: { stringify: true },
  server: {
    port: 5173,
    // Browser-only development: lets src/lib/runner.ts reach the Rust Playground without CORS issues.
    proxy: {
      '/playground': {
        target: 'https://play.rust-lang.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/playground/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 8000,
  },
});
