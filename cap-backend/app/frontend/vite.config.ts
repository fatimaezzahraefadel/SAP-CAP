import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const backendPort = Number(process.env.VITE_BACKEND_PORT || process.env.PORT || 4004);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    proxy: {
      '/odata/v4': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
      // Public file-download route served by the CAP backend (binary streamed
      // from the Attachments table); not under /odata/v4 so it needs its own proxy.
      '/attachments': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
});

