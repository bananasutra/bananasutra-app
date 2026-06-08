/**
 * Build-time `seo-metadata.json` for Cloudflare Worker bot injection.
 * Parity rules: `_docs/planning/SEO/SEO-METADATA-PARITY-R19.md` + `src/catalog/usePageMeta.ts`.
 *
 * Run after `vite build` (needs `dist/`). Invoked from `package.json` `build`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalPathForRoute } from './seo-canonical-path.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcGen = path.join(root, 'src/data/generated')
const distDir = path.join(root, 'dist')
const outFile = path.join(distDir, 'seo-metadata.json')

/** @type {const} — keep in sync with `usePageMeta.ts` */
const SITE = 'BANANASUTRA'
const DEFAULT_DESC =
  'BANANASUTRA — songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.'
const SITE_URL = 'https://bananasutra.com'
/** Non-song routes — composite `dist/og/site.png` (630 slot + copy). Keep in sync with `ogSongCard.mjs` + `usePageMeta.ts`. */
const SITE_OG_CARD_IMAGE = `${SITE_URL}/og/site.png`

/** Match `pageMetaConstants.ts` `padMetaDescription` (SEO parity). */
const META_DESC_MIN_LEN = 100
const META_DESC_PAD =
  'Part of the BANANASUTRA catalog — explore sutras, songbooks, lyrics, SoundCloud tracks, and curated playlists.'

function padMetaDescription(raw) {
  const d = (raw || '').trim()
  if (d.length >= META_DESC_MIN_LEN) return d
  const punct = d && !d.endsWith('.') ? '.' : ''
  const combo = `${d}${punct} ${META_DESC_PAD}`.trim()
  if (combo.length >= META_DESC_MIN_LEN) return combo
  return combo.padEnd(META_DESC_MIN_LEN, '—').slice(0, META_DESC_MIN_LEN).trimEnd()
}

function songOgImageUrl(pathSlug) {
  return `${SITE_URL}/og/songs/${pathSlug}.png`
}

/** Document / OG title as applied by `usePageMeta`. */
function publicTitle(shortTitle) {
  const t = (shortTitle || '').trim()
  return t.includes(SITE) ? t : `${t} · ${SITE}`
}

/** Mirrors `slugify.ts` `lyricsTitleToUrlSlug`. */
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

/** Mirrors `songPaths.ts` `catalogPathSlugFromTitleAndSlug`. */
function catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug) {
  const s = (urlSlug ?? '').trim()
  if (s) return s
  return lyricsTitleToUrlSlug((lyricsTitle || '').trim())
}

/** Mirrors `slugify.ts` `songbookToUrlSlug`. */
function songbookToUrlSlug(songbook) {
  const base = (songbook || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return base || 'songbook'
}

function songbookSlugFromRow(row) {
  const raw = (row.url_slug_songbook || '').trim()
  return raw || songbookToUrlSlug(row.songbook)
}

function firstNonEmptyLine(text) {
  const t = (text || '').trim()
  if (!t) return ''
  const parts = t.split(/\r?\n/)
  for (const p of parts) {
    const x = p.trim()
    if (x) return x
  }
  return ''
}

function songDescription(detail, browseRow) {
  if (detail) {
    const s = (detail.lyrics_summary || '').trim()
    if (s) return s
    const line = firstNonEmptyLine(detail.lyrics_extract || '')
    if (line) return line
    return `Listen to ${detail.lyrics_title} on BANANASUTRA.`
  }
  const s2 = (browseRow.summary_short || '').trim()
  if (s2) return s2
  const line2 = firstNonEmptyLine(browseRow.lyrics_extract || '')
  if (line2) return line2
  return `Listen to ${browseRow.lyrics_title} on BANANASUTRA.`
}

function readJson(rel) {
  const p = path.join(srcGen, rel)
  if (!fs.existsSync(p)) {
    console.error(`generate-seo-metadata: missing ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function routeEntry(shortTitle, description, pathname, image = SITE_OG_CARD_IMAGE, publishedAt = '') {
  const desc = padMetaDescription(description ?? DEFAULT_DESC)
  const entry = {
    title: publicTitle(shortTitle),
    description: desc,
    canonical: `${SITE_URL}${canonicalPathForRoute(pathname)}`,
    type: 'website',
    image,
    author: 'BANANASUTRA',
  }
  const pub = (publishedAt || '').trim()
  if (pub) {
    const iso = pub.includes('T') ? pub : `${pub.slice(0, 10)}T00:00:00Z`
    entry.publishedAt = iso
  }
  return entry
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-seo-metadata: dist/ missing — run `vite build` first')
    process.exit(1)
  }

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const songbooks = readJson('songbook_catalog.json')
  const sutraContext = readJson('sutra_context.json')

  /** @type {Record<string, ReturnType<typeof routeEntry>>} */
  const routes = {}

  function addRoute(pathname, entry) {
    if (routes[pathname]) {
      console.warn(`generate-seo-metadata: duplicate route key ${pathname} — overwriting`)
    }
    routes[pathname] = entry
  }

  // --- Static routes (pathname keys; Worker strips query for lookup) ---
  addRoute(
    '/',
    routeEntry(
      'Songs for a World Gone Bananas',
      'Explore the BANANASUTRA catalog — songs organized by sutra, topic, intention, and sound. Browse songbooks, read lyrics, watch videos, and listen to tracks.',
      '/',
    ),
  )
  addRoute(
    '/learn',
    routeEntry(
      'Learn',
      'What is bananasutra? Start here. The songs make more sense once you know the sutras. Orientation hub for sutras, muses, quotes, and words.',
      '/learn',
    ),
  )
  addRoute(
    '/listen',
    routeEntry(
      'Listen',
      'Press play. The catalog is already sorted into stories. Top tracks for a quick hit. Songbooks when you want a longer ride. Full lyrics on song pages.',
      '/listen',
    ),
  )
  addRoute(
    '/watch',
    routeEntry(
      'Watch',
      'Picture the songs. Same catalog, eyes open. Music videos and YouTube playlists organized by sutra and story.',
      '/watch',
    ),
  )
  addRoute(
    '/songs',
    routeEntry(
      'Songs Catalog',
      'Browse all BANANASUTRA songs. Filter by sutra, topic, intention, genre, and language.',
      '/songs',
    ),
  )
  addRoute(
    '/songbooks',
    routeEntry(
      'Songbooks & Playlists',
      'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
      '/songbooks',
    ),
  )
  addRoute(
    '/tracks',
    routeEntry(
      'Top Tracks on SoundCloud',
      'The best BANANASUTRA tracks, ranked and filterable by tempo, genre, instruments, and moods.',
      '/tracks',
    ),
  )
  // Base `/videos` (no filters): matches `VideosPage` when `titleSuffix` is empty.
  addRoute(
    '/videos',
    routeEntry(
      'Music Videos',
      'BANANASUTRA music videos on YouTube. Browse by sutra, topic, and intention.',
      '/videos',
    ),
  )
  addRoute(
    '/words',
    routeEntry('Lyrics & Words', 'Read BANANASUTRA lyrics. Searchable song words, meaning first.', '/words'),
  )
  addRoute(
    '/about',
    routeEntry(
      'About Bananasutra',
      'What is BANANASUTRA? Songs organized by meaning, not genre, rooted in seven sutras and built by one human with practical tools.',
      '/about',
    ),
  )
  addRoute(
    '/sutras',
    routeEntry(
      'The Seven Sutras',
      'Explore the seven BANANASUTRA sutras, the questions behind them, and the songs they organize.',
      '/sutras',
    ),
  )
  addRoute(
    '/muses',
    routeEntry(
      'The Muses',
      'Explore the thinkers, fools, poets, and troublemakers who inspired BANANASUTRA songs.',
      '/muses',
    ),
  )
  addRoute(
    '/quotes',
    routeEntry(
      'The Quotes',
      'Explore the quotes and ideas behind BANANASUTRA songs, grouped by theme.',
      '/quotes',
    ),
  )
  addRoute(
    '/sitemap',
    routeEntry('Sitemap', 'Full sitemap of BANANASUTRA — all pages, all sutras, all ways to explore.', '/sitemap'),
  )
  addRoute(
    '/style-guide',
    routeEntry(
      'Style guide · Shell',
      'Internal shell reference for the BANANASUTRA catalog: breadcrumbs, page titles, jump nav, and CTAs.',
      '/style-guide',
    ),
  )

  // --- Songbooks (first row wins per slug — matches `songbooks.ts` Map behavior) ---
  const seenSongbookSlug = new Set()
  for (const row of songbooks) {
    const slug = songbookSlugFromRow(row)
    if (!slug || seenSongbookSlug.has(slug)) continue
    seenSongbookSlug.add(slug)
    const pathname = `/songbooks/${slug}`
    const shortTitle = `${row.songbook} · Songbook`
    const desc =
      (row.description || '').trim() || `${row.songbook} — a curated BANANASUTRA songbook.`
    addRoute(pathname, routeEntry(shortTitle, desc, pathname))
  }

  // --- Sutra detail pages ---
  for (const familyKey of Object.keys(sutraContext)) {
    const entry = sutraContext[familyKey]
    const slug = (entry.url_slug_sutra || '').trim().toLowerCase()
    if (!slug) continue
    const pathname = `/about/${slug}`
    const shortTitle = `${familyKey} · Sutra`
    const desc = `Explore the ${familyKey} sutra — songs, featured video, and related songbooks.`
    addRoute(pathname, routeEntry(shortTitle, desc, pathname))
  }

  // --- Songs ---
  let missingDetail = 0
  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    if (!detail) missingDetail += 1
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    const pathname = `/songs/${pathSlug}`
    const shortTitle = `${lyricsTitle} · Song`
    addRoute(
      pathname,
      routeEntry(
        shortTitle,
        songDescription(detail, row),
        pathname,
        songOgImageUrl(pathSlug),
        row.published_at || '',
      ),
    )
  }
  if (missingDetail) {
    console.warn(`generate-seo-metadata: ${missingDetail} browse row(s) missing song_detail.json entry — used browse fallbacks`)
  }

  const sortedKeys = Object.keys(routes).sort((a, b) => a.localeCompare(b))
  /** @type {Record<string, (typeof routes)[string]>} */
  const sortedRoutes = {}
  for (const k of sortedKeys) sortedRoutes[k] = routes[k]

  const payload = {
    routes: sortedRoutes,
    generatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    `generate-seo-metadata: wrote ${outFile} (${sortedKeys.length} routes, ${songBrowse.length} songs in browse)`,
  )
}

main()
