import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { catalogDataDevPlugin } from './vite.catalog-data-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.resolve(__dirname, 'src/data/generated')

// https://vite.dev/config/
export default defineConfig({
  // Default appType is 'spa': `vite preview` uses SPA fallback (requests without a file match
  // become root index.html). For QA of pre-rendered nested HTML under dist/, use `npm run preview:dist`.
  // Custom-domain production deploy runs at origin root (https://bananasutra.com),
  // so deep-link recovery from 404.html requires absolute asset URLs.
  base: '/',
  plugins: [react(), catalogDataDevPlugin(generatedDir)],
  server: {
    // Listen on LAN (0.0.0.0), not only localhost — phones / other machines on the same network can open the dev URL.
    host: true,
    // Keep dev on one predictable origin for BBB CORS and local QA.
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5174,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // Match production chunk layout: keep Vite's CSS preload helper in jsx-runtime
        // instead of a shared vendor megachunk, and avoid lazy routes importing the
        // entry index bundle (circular dep → dynamic import() fails on stage).
        manualChunks(id) {
          if (id.includes('node_modules/react/jsx-runtime') || id.includes('node_modules/react/jsx-dev-runtime')) {
            return 'jsx-runtime'
          }
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router/dist')) {
            return 'react-router'
          }
          if (
            id.includes('/catalog/seoPaths') ||
            id.includes('/catalog/urlState') ||
            id.includes('/catalog/songPaths') ||
            id.includes('/catalog/slugify')
          ) {
            return 'catalog-routing'
          }
          if (id.includes('/lib/analytics') || id.includes('/catalog/catalogAnalytics')) {
            return 'catalog-analytics'
          }
        },
      },
    },
  },
})
