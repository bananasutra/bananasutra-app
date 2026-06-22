/**
 * Build-time Atom feed of newly published songs (R57 / issue 112).
 * Canonical paths match `generate-sitemap.mjs` / `songPaths.ts`.
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
const outFile = path.join(distDir, 'feed.xml')

const SITE_URL = 'https://bananasutra.com'
const FEED_PATH = '/feed.xml'
const FEED_TITLE = 'BANANASUTRA — new songs'
const FEED_SUBTITLE = 'New song pages on BANANASUTRA, organized by sutra, topic, and intention.'
const MAX_ENTRIES = 50

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

function readJson(rel) {
  const p = path.join(srcGen, rel)
  if (!fs.existsSync(p)) {
    console.error(`generate-feed: missing ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toAtomDate(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  const ms = Date.parse(t)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toISOString()
}

function entrySummary(detail, browseRow) {
  const fromDetail = (detail?.lyrics_summary || '').trim()
  if (fromDetail) return fromDetail
  const fromBrowse = (browseRow.summary_short || '').trim()
  if (fromBrowse) return fromBrowse
  const extract = (detail?.lyrics_extract || browseRow.lyrics_extract || '').trim()
  if (extract) return extract.replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ')
  return `New on BANANASUTRA: ${browseRow.lyrics_title}.`
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-feed: dist/ missing — run `vite build` first')
    process.exit(1)
  }

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')

  const candidates = songBrowse
    .map((row) => {
      const lyricsId = (row.lyrics_id || '').trim()
      if (!lyricsId) return null
      const detail = songDetail[lyricsId]
      const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
      const urlSlug = detail?.url_slug ?? row.url_slug
      const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
      const songPath = canonicalPathForRoute(`/songs/${pathSlug}`)
      const published = toAtomDate(row.published_at)
      if (!published) return null
      return {
        title: lyricsTitle || 'Untitled song',
        id: `${SITE_URL}${songPath}`,
        link: `${SITE_URL}${songPath}`,
        published,
        updated: published,
        summary: entrySummary(detail, row),
      }
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, MAX_ENTRIES)

  const feedUpdated =
    candidates[0]?.updated || new Date().toISOString()

  const entries = candidates
    .map(
      (entry) => `  <entry>
    <title>${escapeXml(entry.title)}</title>
    <link href="${escapeXml(entry.link)}" rel="alternate" type="text/html" />
    <id>${escapeXml(entry.id)}</id>
    <published>${entry.published}</published>
    <updated>${entry.updated}</updated>
    <summary type="text">${escapeXml(entry.summary)}</summary>
  </entry>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_SUBTITLE)}</subtitle>
  <link href="${SITE_URL}${FEED_PATH}" rel="self" type="application/atom+xml" />
  <link href="${SITE_URL}${canonicalPathForRoute('/songs')}" rel="alternate" type="text/html" />
  <id>${SITE_URL}/</id>
  <updated>${feedUpdated}</updated>
  <author>
    <name>BANANASUTRA</name>
    <uri>${SITE_URL}/</uri>
  </author>
${entries}
</feed>
`

  fs.writeFileSync(outFile, xml, 'utf8')
  console.log(`generate-feed: wrote ${outFile} (${candidates.length} entries)`)
}

main()
