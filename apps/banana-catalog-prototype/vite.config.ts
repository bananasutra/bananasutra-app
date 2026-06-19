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
          // W-025 — shared catalog helpers used by both HomePortal and player queue must not
          // land in the entry index bundle (verify-build-chunks / stage deploy guardrail).
          if (id.includes('/catalog/durationFormat')) {
            return 'catalog-duration'
          }
          if (id.includes('/seo/imageUrl')) {
            return 'catalog-image-url'
          }
          if (id.includes('/catalog/sutraTheme')) {
            return 'catalog-sutra-theme'
          }
          if (id.includes('/catalog/sutraPageUtils')) {
            return 'catalog-sutra-page-utils'
          }
          if (id.includes('/catalog/songbookPlaylistMeta')) {
            return 'catalog-songbook-meta'
          }
          if (id.includes('/catalog/catalogDataUrl')) {
            return 'catalog-data-url'
          }
          if (id.includes('/catalog/generatedData')) {
            return 'catalog-generated-data'
          }
          if (id.includes('/catalog/catalogFacetConfig')) {
            return 'catalog-facet-config'
          }
          if (id.includes('/catalog/listenLpData')) {
            return 'catalog-listen-lp-data'
          }
          if (id.includes('/catalog/soundcloudWidgetApi')) {
            return 'soundcloud-widget-api'
          }
          if (id.includes('/catalog/soundCloudWidgetPlayback')) {
            return 'soundcloud-widget-playback'
          }
          if (id.includes('/catalog/useExclusiveYoutubeSoundcloudPlayback')) {
            return 'exclusive-yt-sc-playback'
          }
          if (id.includes('/catalog/useExclusiveYoutubeEmbedsPlayback')) {
            return 'exclusive-yt-embeds-playback'
          }
          // Player queue leaf modules — App root + lazy pages both consume; keep out of entry index.
          if (id.includes('/catalog/playerQueue/playerQueueRegistrarContext')) {
            return 'player-queue-registrar'
          }
          if (
            id.includes('/catalog/playerQueue/playerQueueContext') ||
            id.includes('/catalog/playerQueue/usePlayerQueue')
          ) {
            return 'player-queue-context'
          }
          if (id.includes('/catalog/playerQueue/playerQueueInternalsContext')) {
            return 'player-queue-internals'
          }
          if (id.includes('/catalog/playerQueue/usePlayerQueueInternals')) {
            return 'player-queue-internals'
          }
          if (id.includes('/catalog/playerQueue/idleState')) {
            return 'player-queue-idle'
          }
          if (id.includes('/catalog/playerQueue/playableTrackAdapters')) {
            return 'player-queue-adapters'
          }
          if (id.includes('/catalog/playerQueue/songDetailQueue')) {
            return 'player-queue-song-detail'
          }
          if (id.includes('/catalog/playerQueue/tracksPageQueue')) {
            return 'player-queue-tracks-page'
          }
          if (id.includes('/catalog/playerQueue/usePlayerQueuePageBridge')) {
            return 'player-queue-page-bridge'
          }
          if (id.includes('/catalog/playerQueue/queueContextLine')) {
            return 'player-queue-context-line'
          }
          if (id.includes('/catalog/playerQueue/types')) {
            return 'player-queue-types'
          }
          if (id.includes('/catalog/playAllPlatform')) {
            return 'play-all-platform'
          }
          if (id.includes('/catalog/persistentPlayer/persistentScPlayerContext')) {
            return 'persistent-sc-context'
          }
        },
      },
    },
  },
})
