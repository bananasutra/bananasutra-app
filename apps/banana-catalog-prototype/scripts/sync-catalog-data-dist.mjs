/**
 * Copy large catalog JSON into dist/catalog-data/ with stable filenames for production fetch().
 * See catalogDataUrl.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'src/data/generated')
const distDir = path.join(root, 'dist/catalog-data')

const FILES = [
  'song_catalog.json',
  'song_catalog_browse.json',
  'song_search_deep.json',
  'song_detail.json',
  'youtube_by_lyrics_id.json',
  'track_catalog.json',
  'muses_catalog.json',
  'quotes_wall.json',
]

if (!fs.existsSync(path.join(root, 'dist'))) {
  console.error('sync-catalog-data-dist: dist/ missing — run vite build first')
  process.exit(1)
}

fs.mkdirSync(distDir, { recursive: true })
for (const f of FILES) {
  const from = path.join(srcDir, f)
  if (!fs.existsSync(from)) {
    console.error(`sync-catalog-data-dist: missing source ${from}`)
    process.exit(1)
  }
  fs.copyFileSync(from, path.join(distDir, f))
}
console.log(`sync-catalog-data-dist: copied ${FILES.length} files → dist/catalog-data/`)
