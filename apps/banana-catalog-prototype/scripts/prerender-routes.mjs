/**
 * R24 — canonical route list for static pre-render (~440 paths).
 * Keep aligned with `verify-seo-artifacts.mjs` REQUIRED_SEO_PATHS + dynamic slugs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcGen = path.join(__dirname, '../src/data/generated')

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(srcGen, name), 'utf8'))
}

function lyricsTitleToUrlSlug(title) {
  const base = (title || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return base || 'song'
}

function catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug) {
  const s = (urlSlug ?? '').trim()
  if (s) return s
  return lyricsTitleToUrlSlug((lyricsTitle || '').trim())
}

function songbookSlugFromRow(row) {
  const raw = (row.url_slug_songbook || '').trim()
  if (raw) return raw
  const base = (row.songbook || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return base || 'songbook'
}

/** @returns {string[]} sorted unique pathnames */
export function listPrerenderRoutes() {
  const staticRoutes = [
    '/',
    '/learn',
    '/listen',
    '/watch',
    '/songs',
    '/songbooks',
    '/tracks',
    '/videos',
    '/words',
    '/about',
    '/sutras',
    '/muses',
    '/quotes',
    '/manifesto',
    '/sitemap',
    '/style-guide',
  ]

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const songbooks = readJson('songbook_catalog.json')
  const sutraContext = readJson('sutra_context.json')

  const routes = new Set(staticRoutes)

  const seenSongbook = new Set()
  for (const row of songbooks) {
    const slug = songbookSlugFromRow(row)
    if (!slug || seenSongbook.has(slug)) continue
    seenSongbook.add(slug)
    routes.add(`/songbooks/${slug}`)
  }

  for (const key of Object.keys(sutraContext)) {
    const slug = (sutraContext[key].url_slug_sutra || '').trim().toLowerCase()
    if (slug) routes.add(`/sutras/${slug}`)
  }

  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, detail?.url_slug ?? row.url_slug)
    routes.add(`/songs/${pathSlug}`)
  }

  return [...routes].sort((a, b) => a.localeCompare(b))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const routes = listPrerenderRoutes()
  console.log(`prerender-routes: ${routes.length} paths`)
  for (const r of routes) console.log(r)
}
