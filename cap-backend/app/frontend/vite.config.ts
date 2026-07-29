import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const backendPort = Number(process.env.VITE_BACKEND_PORT || process.env.PORT || 4004);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: false,
    target: 'esnext',
    minify: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Keep the biggest stable dependencies out of the main app chunk so
        // app code changes don't invalidate the whole bundle cache.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['motion'],
          'vendor-i18n': [
            'i18next',
            'react-i18next',
            'i18next-browser-languagedetector',
            'i18next-http-backend',
          ],
        },
      },
    },
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

