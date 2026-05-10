import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { catalogDataDevPlugin } from './vite.catalog-data-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.resolve(__dirname, 'src/data/generated')

// https://vite.dev/config/
export default defineConfig({
  // Custom-domain production deploy runs at origin root (https://bananasutra.com),
  // so deep-link recovery from 404.html requires absolute asset URLs.
  base: '/',
  plugins: [react(), catalogDataDevPlugin(generatedDir)],
  server: {
    // Listen on LAN (0.0.0.0), not only localhost — phones / other machines on the same network can open the dev URL.
    host: true,
    // Default Vite is 5173; use 5174 so a stable URL works when another tool already took 5173.
    port: 5174,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 5174,
    strictPort: false,
  },
})
