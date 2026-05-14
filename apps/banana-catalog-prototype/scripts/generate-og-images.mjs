/**
 * Build-time OG images (1200×630): `dist/og/site.png` + `dist/og/songs/{slug}.png` for every song.
 *
 * Left slot is **630×630**: landscape covers are centre-cropped; square / portrait / default icon use
 * `contain` (upscales small assets, no side-crop on square album art).
 *
 * Hybrid overrides: if `public/og/site.png` or `public/og/songs/{slug}.png` exists, Vite copies to dist first —
 * this script skips those paths unless **`FORCE_OG=1`** (re-render everything in `dist/og/`, including overwrites).
 *
 * Run after `vite build` (requires `dist/`). Invoked from `package.json` `build`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFonts, renderSiteOgToPng, renderSongOgToPng, songOgDescriptionFromDetail } from './ogSongCard.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcGen = path.join(root, 'src/data/generated')
const distDir = path.join(root, 'dist')
const ogRoot = path.join(distDir, 'og')
const ogSongs = path.join(ogRoot, 'songs')
const siteOgPath = path.join(ogRoot, 'site.png')

const forceOg =
  process.env.FORCE_OG === '1' || process.env.FORCE_OG === 'true' || process.env.FORCE_OG === 'yes'

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

function readJson(rel) {
  const p = path.join(srcGen, rel)
  if (!fs.existsSync(p)) {
    console.error(`generate-og-images: missing ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function coverUrlFromRow(detail, row) {
  return ((detail?.cover_image_url ?? row?.cover_image_url) || '').trim()
}

/** Drop PNGs for slugs no longer in the catalog snapshot. */
function pruneOrphanSongOgPngs(songBrowse, songDetail) {
  const keep = new Set()
  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    keep.add(slug)
  }
  if (!fs.existsSync(ogSongs)) return
  let removed = 0
  for (const name of fs.readdirSync(ogSongs)) {
    if (!name.endsWith('.png')) continue
    const slug = name.replace(/\.png$/i, '')
    if (!keep.has(slug)) {
      fs.unlinkSync(path.join(ogSongs, name))
      removed += 1
    }
  }
  if (removed) console.log(`generate-og-images: pruned ${removed} stale song PNG(s) (slug removed from catalog)`)
}

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-og-images: dist/ missing — run `vite build` first')
    process.exit(1)
  }

  fs.mkdirSync(ogSongs, { recursive: true })

  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')

  pruneOrphanSongOgPngs(songBrowse, songDetail)

  const fonts = loadFonts(root)

  if (forceOg || !fs.existsSync(siteOgPath)) {
    try {
      const sitePng = await renderSiteOgToPng({ rootDir: root, fonts })
      fs.writeFileSync(siteOgPath, sitePng)
      console.log(`generate-og-images: wrote ${siteOgPath}${forceOg ? ' (FORCE_OG)' : ''}`)
    } catch (e) {
      console.error('generate-og-images: FAILED dist/og/site.png', e)
      process.exit(1)
    }
  } else {
    console.log('generate-og-images: skip dist/og/site.png (already present; set FORCE_OG=1 to overwrite)')
  }

  let wrote = 0
  let skippedHasFile = 0
  let failed = 0

  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    const displayTitle = lyricsTitle || slug
    const cover = coverUrlFromRow(detail, row) || null
    const lyricsSummary = songOgDescriptionFromDetail(detail) || null

    const outPath = path.join(ogSongs, `${slug}.png`)
    if (!forceOg && fs.existsSync(outPath)) {
      skippedHasFile += 1
      continue
    }

    try {
      const png = await renderSongOgToPng({
        rootDir: root,
        displayTitle,
        coverImageUrl: cover,
        lyricsSummary,
        fonts,
      })
      fs.writeFileSync(outPath, png)
      wrote += 1
    } catch (e) {
      failed += 1
      console.error(`generate-og-images: FAILED slug=${slug} cover=${cover || '(default icon)'}\n`, e)
    }
  }

  if (failed) {
    console.error(`generate-og-images: ${failed} song(s) failed — fix network or URLs, then rebuild`)
    process.exit(1)
  }

  console.log(
    `generate-og-images: song PNGs wrote ${wrote}, skipped (already in dist) ${skippedHasFile}${forceOg ? ' (FORCE_OG: expect 0 skips)' : ''} — every slug gets a composite; no-cover uses brand icon in 630 slot`,
  )
}

await main()
