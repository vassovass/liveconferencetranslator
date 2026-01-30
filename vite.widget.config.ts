/**
 * Vite Widget Build Configuration
 *
 * Builds the embeddable widget as:
 * - IIFE bundle for script tag usage
 * - ES module for modern imports
 *
 * Usage:
 *   npm run build:widget
 */

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/widget/index.ts'),
      name: 'LiveTranslator',
      formats: ['iife', 'es'],
      fileName: (format) => `live-translator.${format === 'iife' ? 'min' : 'esm'}.js`,
    },
    rollupOptions: {
      // Don't externalize React for IIFE - bundle everything
      external: [],
      output: {
        // Global variable names for IIFE
        globals: {},
        // Ensure CSS is extracted
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'live-translator.css';
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    // Output directory for widget
    outDir: 'dist/widget',
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
      },
    },
    // Target modern browsers
    target: 'es2020',
    // CSS code splitting disabled for single file
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
