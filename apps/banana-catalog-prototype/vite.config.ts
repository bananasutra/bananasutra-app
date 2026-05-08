import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs work for both GitHub project pages (/repo-name/)
  // and custom domains at root without rebuilding.
  base: './',
  plugins: [react()],
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
