/**
 * Build-time `llms.txt` for AI crawlers (R57 / issue 115).
 * Spec: https://llmstxt.org/
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
const outFile = path.join(distDir, 'llms.txt')

const SITE_URL = 'https://bananasutra.com'
const SITE_SUMMARY =
  'BANANASUTRA — songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.'
const NEW_SONGS_LIMIT = 12

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
    console.error(`generate-llms-txt: missing ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function abs(pathname) {
  return `${SITE_URL}${canonicalPathForRoute(pathname)}`
}

function mdLink(label, pathname) {
  return `- [${label}](${abs(pathname)})`
}

function songBlurb(detail, browseRow) {
  const s = (detail?.lyrics_summary || browseRow.summary_short || '').trim()
  if (s) return s
  const extract = (detail?.lyrics_extract || browseRow.lyrics_extract || '').trim()
  if (extract) return extract.replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ')
  return 'Song page with lyrics, tracks, and context.'
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-llms-txt: dist/ missing — run `vite build` first')
    process.exit(1)
  }

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const sutraContext = readJson('sutra_context.json')

  const recentSongs = songBrowse
    .map((row) => {
      const lyricsId = (row.lyrics_id || '').trim()
      if (!lyricsId) return null
      const published = String(row.published_at || '').trim()
      if (!published || !Number.isFinite(Date.parse(published))) return null
      const detail = songDetail[lyricsId]
      const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
      const urlSlug = detail?.url_slug ?? row.url_slug
      const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
      return {
        title: lyricsTitle || 'Untitled song',
        pathname: `/songs/${pathSlug}`,
        publishedMs: Date.parse(published),
        blurb: songBlurb(detail, row),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .slice(0, NEW_SONGS_LIMIT)

  const sutraLines = Object.keys(sutraContext)
    .sort()
    .map((familyKey) => {
      const entry = sutraContext[familyKey]
      const slug = (entry.url_slug_sutra || '').trim().toLowerCase()
      if (!slug) return null
      const name = (entry.sutra || familyKey).trim()
      const tagline = (entry.question || entry.sutra_card_essence || '').trim()
      const label = tagline ? `${name}: ${tagline}` : name
      return `- [${label}](${abs(`/sutras/${slug}`)})`
    })
    .filter(Boolean)

  const lines = [
    '# BANANASUTRA',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    '## Start here',
    '',
    mdLink('Home', '/'),
    mdLink('About', '/about'),
    mdLink('Manifesto', '/manifesto'),
  ]

  lines.push(
    '',
    '## Browse the catalog',
    '',
    mdLink('Learn', '/learn'),
    mdLink('Listen', '/listen'),
    mdLink('Watch', '/watch'),
    mdLink('Songs', '/songs'),
    mdLink('Tracks', '/tracks'),
    mdLink('Videos', '/videos'),
    mdLink('Lyrics and words', '/words'),
    mdLink('Songbooks', '/songbooks'),
    '',
    '## About hubs',
    '',
    mdLink('Sutras', '/sutras'),
    mdLink('Muses', '/muses'),
    mdLink('Quotes', '/quotes'),
    '',
    '## Seven sutras',
    '',
    ...sutraLines,
    '',
    '## New songs',
    '',
    ...recentSongs.map((song) => `- [${song.title}](${abs(song.pathname)}): ${song.blurb}`),
    '',
    '## Machine-readable',
    '',
    `- [XML sitemap](${SITE_URL}/sitemap.xml)`,
    `- [Atom feed (new songs)](${SITE_URL}/feed.xml)`,
    `- [Robots](${SITE_URL}/robots.txt)`,
    `- [SEO metadata JSON](${SITE_URL}/seo-metadata.json)`,
    '',
  )

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8')
  console.log(`generate-llms-txt: wrote ${outFile}`)
}

main()
