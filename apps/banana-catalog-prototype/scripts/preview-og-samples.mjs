/**
 * Renders a small set of OG PNGs for design review (does not touch `dist/og/`).
 *
 * Usage (from `apps/banana-catalog-prototype`):
 *   npm run og:samples
 *
 * Output: `og-samples/` (gitignored) + `og-samples/README.txt`
 *
 * Requires network to fetch cover URLs from SoundCloud / YouTube CDNs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFonts, renderSiteOgToPng, renderSongOgToPng, songOgDescriptionFromDetail } from './ogSongCard.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcGen = path.join(root, 'src/data/generated')
const outDir = path.join(root, 'og-samples')

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(srcGen, rel), 'utf8'))
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

function coverUrlFromRow(detail, row) {
  return ((detail?.cover_image_url ?? row?.cover_image_url) || '').trim()
}

/** Fixed slugs to always try (curated review set). */
const CURATED_SLUGS = [
  'lyrics-matter-foosutra-edit',
  'a-cabaret-where-no-one-knows',
  'ego-ain-t-your-amigo',
  'curious-like-a-kiss',
]

function findBySlug(songBrowse, songDetail, wantSlug) {
  for (const row of songBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    if (slug === wantSlug) {
      return { row, detail, lyricsId, slug, lyricsTitle }
    }
  }
  return null
}

function pickExtraSamples(songBrowse, songDetail, exclude) {
  const extras = []
  for (const row of songBrowse) {
    if (extras.length >= 4) break
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId) continue
    const detail = songDetail[lyricsId]
    const lyricsTitle = (detail?.lyrics_title || row.lyrics_title || '').trim()
    const urlSlug = detail?.url_slug ?? row.url_slug
    const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
    if (exclude.has(slug)) continue
    const cover = coverUrlFromRow(detail, row)
    if (!cover) continue
    if (cover.includes('i.ytimg.com')) {
      extras.push({ row, detail, lyricsId, slug, lyricsTitle, note: 'YouTube maxres-style cover' })
    }
  }
  return extras
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const songBrowse = readJson('song_catalog_browse.json')
  const songDetail = readJson('song_detail.json')
  const fonts = loadFonts(root)

  const manifest = []
  const jobs = []
  for (const want of CURATED_SLUGS) {
    const hit = findBySlug(songBrowse, songDetail, want)
    if (!hit) {
      manifest.push({ slug: want, status: 'missing', note: 'slug not in current catalog snapshot' })
      continue
    }
    const cover = coverUrlFromRow(hit.detail, hit.row)
    const lyricsBody = songOgDescriptionFromDetail(hit.detail) || null
    jobs.push({
      slug: hit.slug,
      title: hit.lyricsTitle,
      cover: cover || null,
      lyricsSummary: lyricsBody,
      note: cover ? 'curated' : 'curated (no cover_image_url — brand icon in 630 slot, same as production build)',
    })
  }

  for (const extra of pickExtraSamples(songBrowse, songDetail, new Set(jobs.map((j) => j.slug)))) {
    jobs.push({
      slug: extra.slug,
      title: extra.lyricsTitle,
      cover: coverUrlFromRow(extra.detail, extra.row),
      lyricsSummary: songOgDescriptionFromDetail(extra.detail) || null,
      note: extra.note,
    })
  }

  const lines = [
    'OG sample pack — review layout only (does not write dist/og/).',
    '',
    'Types: song-* = per-song card; site-* = non-song composite (one production site.png uses home copy only).',
    'Song cards: eyebrow = tagline (same type as site “Ideas you can feel.”), then title, body, BANANASUTRA, URL.',
    'Preview variant: curious-like-a-kiss--body-plus-1.png = same song, larger description font for comparison.',
    '',
  ]

  const siteSamples = [
    {
      file: 'site--home.png',
      note: 'shared site.png default (/)',
      opts: {},
    },
    {
      file: 'site--songs-catalog.png',
      note: 'illustrative /songs copy (not shipped as separate file today)',
      opts: {
        heroTitle: 'Songs Catalog',
        metaDescription:
          'Browse all BANANASUTRA songs. Filter by sutra, topic, intention, genre, and language.',
      },
    },
    {
      file: 'site--about.png',
      note: 'illustrative /about copy',
      opts: {
        heroTitle: 'About Bananasutra',
        metaDescription:
          'What is BANANASUTRA? Songs organized by meaning, not genre, rooted in seven sutras and built by one human with practical tools.',
      },
    },
  ]

  for (const s of siteSamples) {
    const outPath = path.join(outDir, s.file)
    try {
      const png = await renderSiteOgToPng({ rootDir: root, fonts, ...s.opts })
      fs.writeFileSync(outPath, png)
      manifest.push({ type: 'site', file: s.file, note: s.note, status: 'ok' })
      lines.push(`OK  ${s.file}`)
      lines.push(`    note: ${s.note}`)
      lines.push('')
    } catch (e) {
      manifest.push({ type: 'site', file: s.file, status: 'error', error: String(e?.message || e) })
      lines.push(`ERR ${s.file}: ${e?.message || e}`)
      lines.push('')
    }
  }

  for (const job of jobs) {
    const safeName = job.slug.replace(/[^a-z0-9-]+/gi, '-')
    const file = `${safeName}.png`
    const outPath = path.join(outDir, file)
    try {
      const png = await renderSongOgToPng({
        rootDir: root,
        displayTitle: job.title,
        coverImageUrl: job.cover,
        lyricsSummary: job.lyricsSummary,
        fonts,
      })
      fs.writeFileSync(outPath, png)
      manifest.push({
        type: 'song',
        slug: job.slug,
        file,
        title: job.title,
        cover: job.cover,
        lyricsSummary: job.lyricsSummary,
        note: job.note,
        status: 'ok',
      })
      lines.push(`OK  ${file}`)
      lines.push(`    slug: ${job.slug}`)
      lines.push(`    note: ${job.note}`)
      lines.push(`    cover: ${job.cover}`)
      lines.push('')

      if (job.slug === 'curious-like-a-kiss') {
        const altFile = 'curious-like-a-kiss--body-plus-1.png'
        const altPath = path.join(outDir, altFile)
        const altPng = await renderSongOgToPng({
          rootDir: root,
          displayTitle: job.title,
          coverImageUrl: job.cover,
          lyricsSummary: job.lyricsSummary,
          fonts,
          songTypography: { bodyFontSize: 25 },
        })
        fs.writeFileSync(altPath, altPng)
        manifest.push({
          type: 'song',
          slug: job.slug,
          file: altFile,
          title: job.title,
          note: 'same as curious-like-a-kiss.png but bodyFontSize 25 (default body is 22)',
          status: 'ok',
        })
        lines.push(`OK  ${altFile}`)
        lines.push(`    note: larger description font preview (+3px vs default)`)
        lines.push('')
      }
    } catch (e) {
      manifest.push({ slug: job.slug, status: 'error', error: String(e?.message || e) })
      lines.push(`ERR ${file} (${job.slug}): ${e?.message || e}`)
      lines.push('')
    }
  }

  fs.writeFileSync(path.join(outDir, 'README.txt'), `${lines.join('\n')}\n`, 'utf8')
  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(
    `preview-og-samples: wrote ${outDir}/ (${manifest.filter((m) => m.status === 'ok').length} PNG(s) — open folder to review; no dist/og rebuild)`,
  )
}

await main()
