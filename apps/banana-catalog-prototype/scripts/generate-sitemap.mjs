/**
 * Build-time `sitemap.xml` for search engines (Goal 2, SEO epic §2.1).
 * Canonical paths match `generate-seo-metadata.mjs` / `songPaths.ts` / R19.
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
const outFile = path.join(distDir, 'sitemap.xml')

const SITE_URL = 'https://bananasutra.com'

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

function readJson(rel) {
  const p = path.join(srcGen, rel)
  if (!fs.existsSync(p)) {
    console.error(`generate-sitemap: missing ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const BUILD_LASTMOD = new Date().toISOString().slice(0, 10)

/** YYYY-MM-DD for `<lastmod>`; empty string if unusable. */
function lastmodDateOnly(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  const ms = Date.parse(t)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

function songLastmod(browseRow, detail) {
  return (
    lastmodDateOnly(browseRow.published_at) ||
    lastmodDateOnly(detail?.updated_at) ||
    lastmodDateOnly(detail?.tracks?.[0]?.created_at) ||
    BUILD_LASTMOD
  )
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-sitemap: dist/ missing — run `vite build` first')
    process.exit(1)
  }

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const songbooks = readJson('songbook_catalog.json')
  const sutraContext = readJson('sutra_context.json')

  /** @type {{ loc: string; lastmod: string; changefreq: string; priority: string }[]} */
  const rows = []

  function push(pathname, opts) {
    const locPath = canonicalPathForRoute(pathname)
    const loc = `${SITE_URL}${locPath}`
    rows.push({
      loc,
      lastmod: opts.lastmod || BUILD_LASTMOD,
      changefreq: opts.changefreq,
      priority: opts.priority,
    })
  }

  // Epic §2.1 static list (no /style-guide — internal shell page)
  push('/', { changefreq: 'weekly', priority: '1.0', lastmod: BUILD_LASTMOD })

  for (const p of ['/learn', '/listen', '/watch', '/songs', '/tracks', '/videos', '/words', '/songbooks']) {
    push(p, { changefreq: 'weekly', priority: '0.9', lastmod: BUILD_LASTMOD })
  }

  for (const p of ['/about', '/sutras', '/muses', '/quotes', '/manifesto', '/privacy']) {
    push(p, { changefreq: 'monthly', priority: '0.8', lastmod: BUILD_LASTMOD })
  }

  for (const familyKey of Object.keys(sutraContext)) {
    const entry = sutraContext[familyKey]
    const slug = (entry.url_slug_sutra || '').trim().toLowerCase()
    if (!slug) continue
    push(`/sutras/${slug}`, { changefreq: 'monthly', priority: '0.8', lastmod: BUILD_LASTMOD })
  }

  const seenSongbookSlug = new Set()
  for (const row of songbooks) {
    const slug = songbookSlugFromRow(row)
    if (!slug || seenSongbookSlug.has(slug)) continue
    seenSongbookSlug.add(slug)
    push(`/songbooks/${slug}`, { changefreq: 'monthly', priority: '0.7', lastmod: BUILD_LASTMOD })
  }

  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    push(`/songs/${pathSlug}`, {
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: songLastmod(row, detail),
    })
  }

  push('/sitemap', { changefreq: 'yearly', priority: '0.5', lastmod: BUILD_LASTMOD })

  rows.sort((a, b) => a.loc.localeCompare(b.loc))

  const body = rows
    .map((r) => {
      const lm = r.lastmod || BUILD_LASTMOD
      return `  <url>
    <loc>${escapeXml(r.loc)}</loc>
    <lastmod>${escapeXml(lm)}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`

  fs.writeFileSync(outFile, xml, 'utf8')
  console.log(`generate-sitemap: wrote ${outFile} (${rows.length} URLs)`)
}

main()
