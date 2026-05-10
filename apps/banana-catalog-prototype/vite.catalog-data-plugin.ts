/**
 * Dev-only: serve `/catalog-data/*.json` from `src/data/generated/` so production-style URLs work locally.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** Must match `scripts/sync-catalog-data-dist.mjs` and `catalogDataUrl.types.ts`. */
export const CATALOG_DATA_FILENAMES = [
  'song_catalog.json',
  'song_catalog_browse.json',
  'song_search_deep.json',
  'song_detail.json',
  'youtube_by_lyrics_id.json',
  'track_catalog.json',
] as const

const ALLOWED = new Set<string>(CATALOG_DATA_FILENAMES)

export function catalogDataDevPlugin(genDir: string): Plugin {
  return {
    name: 'catalog-data-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        if (!raw.startsWith('/catalog-data/')) {
          next()
          return
        }
        const name = decodeURIComponent(raw.slice('/catalog-data/'.length))
        if (!ALLOWED.has(name)) {
          next()
          return
        }
        const fp = path.join(genDir, name)
        let st: fs.Stats
        try {
          st = fs.statSync(fp)
        } catch {
          next()
          return
        }
        if (!st.isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        fs.createReadStream(fp).pipe(res).on('error', next)
      })
    },
  }
}
