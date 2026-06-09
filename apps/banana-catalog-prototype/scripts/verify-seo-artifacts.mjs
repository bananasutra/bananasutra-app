/**
 * Task 11 — Local QA: `dist/seo-metadata.json` + `dist/sitemap.xml` shape, counts, parseability.
 * Run after `npm run build` (or in CI right after build).
 *
 * Expected route counts are derived from `src/data/generated/*.json` using the same
 * slug rules as `generate-seo-metadata.mjs` / `generate-sitemap.mjs`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { canonicalPathForRoute } from './seo-canonical-path.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcGen = path.join(root, 'src/data/generated')
const distDir = path.join(root, 'dist')
const seoPath = path.join(distDir, 'seo-metadata.json')
const sitemapPath = path.join(distDir, 'sitemap.xml')

const SITE = 'BANANASUTRA'
const SITE_URL = 'https://bananasutra.com'
const SITE_OG_CARD_IMAGE = `${SITE_URL}/og/site.png`

function expectedOgImageUrl(pathname) {
  if (pathname.startsWith('/songs/') && pathname !== '/songs') {
    const slug = pathname.slice('/songs/'.length)
    return `${SITE_URL}/og/songs/${slug}.png`
  }
  return SITE_OG_CARD_IMAGE
}

function isAllowedOgImageUrl(url) {
  if (url === SITE_OG_CARD_IMAGE) return true
  if (url.startsWith(`${SITE_URL}/og/songs/`) && url.endsWith('.png')) return true
  return false
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

function publicTitle(shortTitle) {
  const t = (shortTitle || '').trim()
  return t.includes(SITE) ? t : `${t} · ${SITE}`
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(srcGen, rel), 'utf8'))
}

function fail(msg) {
  console.error(`verify-seo-artifacts: FAIL — ${msg}`)
  process.exit(1)
}

function warn(msg) {
  console.warn(`verify-seo-artifacts: WARN — ${msg}`)
}

/** Paths that must exist in seo-metadata (includes `/style-guide`; sitemap omits it). */
const REQUIRED_SEO_PATHS = [
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

/** Paths that must exist in sitemap.xml `<loc>` (epic §2.1, no style-guide). */
const REQUIRED_SITEMAP_PATHS = REQUIRED_SEO_PATHS.filter((p) => p !== '/style-guide')

function expectedSutraPathnames(sutraContext) {
  const out = []
  for (const key of Object.keys(sutraContext)) {
    const slug = (sutraContext[key].url_slug_sutra || '').trim().toLowerCase()
    if (slug) out.push(`/sutras/${slug}`)
  }
  return out.sort()
}

function expectedSongbookPathnames(songbooks) {
  const seen = new Set()
  const paths = []
  for (const row of songbooks) {
    const slug = songbookSlugFromRow(row)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    paths.push(`/songbooks/${slug}`)
  }
  return paths.sort()
}

function expectedSongPathnames(songBrowse, songDetail) {
  const map = new Map()
  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const pathSlug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    map.set(`/songs/${pathSlug}`, lyricsId)
  }
  return map
}

function extractSitemapLocs(xml) {
  const locs = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim())
  }
  return locs
}

function pathFromLoc(loc) {
  try {
    const u = new URL(loc)
    if (u.origin !== SITE_URL) return null
    const p = u.pathname.replace(/\/+$/, '') || '/'
    return p === '' ? '/' : p
  } catch {
    return null
  }
}

function main() {
  if (!fs.existsSync(seoPath)) fail(`missing ${seoPath} — run npm run build first`)
  if (!fs.existsSync(sitemapPath)) fail(`missing ${sitemapPath} — run npm run build first`)

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const songbooks = readJson('songbook_catalog.json')
  const sutraContext = readJson('sutra_context.json')

  const expectedSongs = expectedSongPathnames(songBrowse, songDetail)
  const expectedSongbookPaths = new Set(expectedSongbookPathnames(songbooks))
  const expectedSutraPaths = new Set(expectedSutraPathnames(sutraContext))

  let seo
  try {
    seo = JSON.parse(fs.readFileSync(seoPath, 'utf8'))
  } catch (e) {
    fail(`seo-metadata.json is not valid JSON: ${e}`)
  }

  if (!seo.routes || typeof seo.routes !== 'object') fail('seo-metadata: missing routes object')
  if (typeof seo.generatedAt !== 'string' || !Number.isFinite(Date.parse(seo.generatedAt))) {
    fail('seo-metadata: generatedAt missing or not ISO-parsable')
  }

  const routes = seo.routes
  for (const p of REQUIRED_SEO_PATHS) {
    if (!routes[p]) fail(`seo-metadata: missing required route key ${p}`)
  }

  for (const [p, meta] of Object.entries(routes)) {
    if (typeof meta?.title !== 'string' || !meta.title.trim()) fail(`seo-metadata: empty title for ${p}`)
    if (typeof meta?.description !== 'string' || !meta.description.trim()) {
      fail(`seo-metadata: empty description for ${p}`)
    }
    if (meta?.type !== 'website') fail(`seo-metadata: expected type "website" for ${p}`)
    if (typeof meta?.canonical !== 'string' || !meta.canonical.startsWith(SITE_URL)) {
      fail(`seo-metadata: bad canonical for ${p}`)
    }
    const wantCanonical = `${SITE_URL}${canonicalPathForRoute(p)}`
    if (meta.canonical !== wantCanonical) {
      fail(`seo-metadata: canonical mismatch for ${p}\n  want: ${wantCanonical}\n  got:  ${meta.canonical}`)
    }
    if (typeof meta?.image !== 'string' || !isAllowedOgImageUrl(meta.image)) {
      fail(`seo-metadata: missing or invalid image for ${p}`)
    }
    const wantImg = expectedOgImageUrl(p)
    if (meta.image !== wantImg) {
      fail(`seo-metadata: image mismatch for ${p}\n  want: ${wantImg}\n  got:  ${meta.image}`)
    }
  }

  // Per-route title sanity: home uses known short title → fixed public title
  const homeMeta = routes['/']
  const wantHomeTitle = publicTitle('Songs for a World Gone Bananas')
  if (homeMeta.title !== wantHomeTitle) {
    fail(`seo-metadata: home title mismatch\n  want: ${wantHomeTitle}\n  got:  ${homeMeta.title}`)
  }

  // Song titles: every /songs/* must match `${title} · Song` + usePageMeta suffix rule
  for (const [pathname, meta] of Object.entries(routes)) {
    if (!pathname.startsWith('/songs/') || pathname === '/songs') continue
    const lyricsId = expectedSongs.get(pathname)
    if (!lyricsId) fail(`seo-metadata: unexpected song path (not in browse/detail model) ${pathname}`)
    const detail = songDetail[lyricsId]
    const row = songBrowse.find((r) => r.lyrics_id === lyricsId)
    const lyricsTitle = (detail?.lyrics_title || row?.lyrics_title || '').trim()
    const want = publicTitle(`${lyricsTitle} · Song`)
    if (meta.title !== want) {
      fail(`seo-metadata: song title mismatch for ${pathname}\n  want: ${want}\n  got:  ${meta.title}`)
    }
  }

  const songKeys = Object.keys(routes).filter((k) => k.startsWith('/songs/') && k !== '/songs')
  if (songKeys.length !== expectedSongs.size) {
    fail(`seo-metadata: song route count ${songKeys.length} !== expected unique slugs ${expectedSongs.size}`)
  }

  const bookKeys = Object.keys(routes).filter((k) => k.startsWith('/songbooks/') && k !== '/songbooks')
  if (bookKeys.length !== expectedSongbookPaths.size) {
    fail(`seo-metadata: songbook route count ${bookKeys.length} !== expected ${expectedSongbookPaths.size}`)
  }
  for (const k of bookKeys) {
    if (!expectedSongbookPaths.has(k)) fail(`seo-metadata: unexpected songbook path ${k}`)
  }

  const sutraKeys = Object.keys(routes).filter((k) => expectedSutraPaths.has(k))
  if (sutraKeys.length !== expectedSutraPaths.size) {
    fail(`seo-metadata: sutra route count ${sutraKeys.length} !== expected ${expectedSutraPaths.size}`)
  }

  // --- Sitemap ---
  const xml = fs.readFileSync(sitemapPath, 'utf8')
  if (!xml.trimStart().startsWith('<?xml')) fail('sitemap.xml: missing XML declaration')
  if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    fail('sitemap.xml: missing sitemap urlset xmlns')
  }

  try {
    execFileSync('xmllint', ['--noout', sitemapPath], { stdio: 'pipe' })
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : undefined
    if (code === 'ENOENT') {
      warn('xmllint not on PATH — skipped strict XML check (optional: brew install libxml2)')
    } else {
      const errText = e && typeof e === 'object' && 'stderr' in e && e.stderr ? String(e.stderr) : String(e)
      fail(`sitemap.xml failed xmllint --noout:\n${errText}`)
    }
  }

  const locs = extractSitemapLocs(xml)
  if (locs.length === 0) fail('sitemap.xml: no <loc> entries found')
  const lastmodCount = (xml.match(/<lastmod>/g) || []).length
  if (lastmodCount !== locs.length) {
    fail(`sitemap.xml: ${lastmodCount} <lastmod> tag(s) !== ${locs.length} <loc> entries`)
  }

  const sitemapPaths = new Set()
  const dup = new Set()
  for (const loc of locs) {
    const p = pathFromLoc(loc)
    if (!p) fail(`sitemap.xml: bad loc URL ${loc}`)
    const wantLoc = `${SITE_URL}${canonicalPathForRoute(p)}`
    if (loc !== wantLoc) {
      fail(`sitemap.xml: loc mismatch for ${p}\n  want: ${wantLoc}\n  got:  ${loc}`)
    }
    if (sitemapPaths.has(p)) dup.add(p)
    sitemapPaths.add(p)
  }
  if (dup.size) fail(`sitemap.xml: duplicate paths: ${[...dup].join(', ')}`)

  for (const p of REQUIRED_SITEMAP_PATHS) {
    if (!sitemapPaths.has(p)) fail(`sitemap.xml: missing required path ${p}`)
  }
  if (sitemapPaths.has('/style-guide')) fail('sitemap.xml: should not list internal /style-guide')

  for (const p of expectedSutraPaths) {
    if (!sitemapPaths.has(p)) fail(`sitemap.xml: missing sutra path ${p}`)
  }
  for (const p of expectedSongbookPaths) {
    if (!sitemapPaths.has(p)) fail(`sitemap.xml: missing songbook path ${p}`)
  }
  for (const p of expectedSongs.keys()) {
    if (!sitemapPaths.has(p)) fail(`sitemap.xml: missing song path ${p}`)
  }

  const expectedSitemapSize =
    REQUIRED_SITEMAP_PATHS.length + expectedSutraPaths.size + expectedSongbookPaths.size + expectedSongs.size
  if (sitemapPaths.size !== expectedSitemapSize) {
    fail(`sitemap.xml: total URLs ${sitemapPaths.size} !== expected ${expectedSitemapSize}`)
  }

  // R24 — spot-check static pre-render (body in #root, JSON-LD in <head>)
  const prerenderSample = path.join(distDir, 'songs/ego-ain-t-your-amigo/index.html')
  if (fs.existsSync(prerenderSample)) {
    const sampleHtml = fs.readFileSync(prerenderSample, 'utf8')
    const rootM = /<div id="root">([\s\S]*)<\/div>\s*<\/body>/.exec(sampleHtml)
    const rootBody = rootM ? rootM[1] : ''
    if (!rootBody.includes('song-detail-title')) {
      fail('prerender sample: #root missing song-detail body (run prerender-html after vite build)')
    }
    const head = sampleHtml.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    if (!head.includes('application/ld+json')) {
      fail('prerender sample: <head> missing JSON-LD script')
    }
    if (!head.includes('MusicRecording')) {
      fail('prerender sample: <head> JSON-LD missing MusicRecording')
    }
    if ((rootBody.match(/application\/ld\+json/g) || []).length > 0) {
      fail('prerender sample: JSON-LD should not remain inside #root')
    }
  } else {
    warn('prerender sample missing — skip R24 body check (dist/songs/ego-ain-t-your-amigo/index.html)')
  }

  const songbookPrerender = path.join(distDir, 'songbooks/ask-naked-truth/index.html')
  if (fs.existsSync(songbookPrerender)) {
    const head = fs.readFileSync(songbookPrerender, 'utf8').match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    if (!head.includes('MusicAlbum') && !head.includes('ItemList')) {
      fail('prerender songbook sample: <head> JSON-LD missing MusicAlbum or ItemList')
    }
  }

  const sutraPrerender = path.join(distDir, 'sutras/knowsutra/index.html')
  if (fs.existsSync(sutraPrerender)) {
    const head = fs.readFileSync(sutraPrerender, 'utf8').match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    if (!head.includes('CreativeWork')) {
      fail('prerender sutra sample: <head> JSON-LD missing CreativeWork')
    }
    if (!head.includes('https://bananasutra.com/sutras/knowsutra/')) {
      fail('prerender sutra sample: missing canonical https://bananasutra.com/sutras/knowsutra/')
    }
  }

  // W-074 — legacy About hub paths emit static redirect HTML (GitHub Pages)
  for (const legacy of ['/about/sutras', '/about/muses', '/about/quotes']) {
    const redirectPath = path.join(distDir, legacy.replace(/^\//, ''), 'index.html')
    if (!fs.existsSync(redirectPath)) {
      fail(`missing legacy redirect HTML at dist/${legacy.replace(/^\//, '')}/index.html — run generate-route-redirects.mjs`)
    }
    const html = fs.readFileSync(redirectPath, 'utf8')
    if (!html.includes('rel="canonical"') || !html.includes('window.location.replace')) {
      fail(`legacy redirect HTML at ${legacy} missing canonical or JS redirect`)
    }
  }

  for (const legacySutra of expectedSutraPathnames(sutraContext)) {
    const legacyPath = legacySutra.replace(/^\/sutras\//, '/about/')
    const redirectPath = path.join(distDir, legacyPath.replace(/^\//, ''), 'index.html')
    if (!fs.existsSync(redirectPath)) {
      fail(`missing legacy sutra redirect HTML at dist/${legacyPath.replace(/^\//, '')}/index.html — run generate-route-redirects.mjs`)
    }
    const html = fs.readFileSync(redirectPath, 'utf8')
    const wantTarget = canonicalPathForRoute(legacySutra)
    if (!html.includes('rel="canonical"') || !html.includes(wantTarget) || !html.includes('window.location.replace')) {
      fail(`legacy sutra redirect HTML at ${legacyPath} missing canonical target ${wantTarget}`)
    }
  }

  const flatHubPrerender = path.join(distDir, 'sutras/index.html')
  if (fs.existsSync(flatHubPrerender)) {
    const head = fs.readFileSync(flatHubPrerender, 'utf8').match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    if (!head.includes('rel="canonical"') || !head.includes('https://bananasutra.com/sutras/')) {
      fail('prerender /sutras: missing canonical https://bananasutra.com/sutras/')
    }
  }

  const siteOgPath = path.join(distDir, 'og/site.png')
  if (!fs.existsSync(siteOgPath)) {
    fail(`missing ${siteOgPath} — run full catalog build (generate-og-images after vite)`)
  }

  const ogSongsDir = path.join(distDir, 'og/songs')
  if (!fs.existsSync(ogSongsDir)) {
    fail(`missing ${ogSongsDir} — run full catalog build (generate-og-images after vite)`)
  }
  const songPngCount = fs.readdirSync(ogSongsDir).filter((f) => f.endsWith('.png')).length
  if (songPngCount !== expectedSongs.size) {
    fail(
      `dist/og/songs: ${songPngCount} png file(s), expected ${expectedSongs.size} (one composite per song route)`,
    )
  }

  // Spot-check: browse length ~ epic (informational)
  const nBrowse = songBrowse.filter((r) => (r.lyrics_id || '').trim()).length
  if (nBrowse < 300 || nBrowse > 500) warn(`song_catalog_browse row count ${nBrowse} outside typical 300–500 (epic ~387)`)

  console.log(
    `verify-seo-artifacts: OK — seo-metadata ${Object.keys(routes).length} routes, sitemap ${locs.length} URLs, ${nBrowse} browse rows`,
  )
}

main()
