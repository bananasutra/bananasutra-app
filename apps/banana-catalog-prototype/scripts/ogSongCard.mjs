/**
 * Shared 1200×630 OG card: **630×630** left slot + catalog typography (right).
 *
 * Left slot rules:
 * - **Landscape** (width/height ≥ ~1.12, e.g. 16:9 YouTube): `cover` crop from centre → 630×630.
 * - **Square / portrait / default icon**: `contain` inside 630×630 on paper (small sources upscale, uncropped).
 *
 * Used by `generate-og-images.mjs` and `preview-og-samples.mjs`.
 *
 * Song right column: **eyebrow** tagline (same style as site kicker) → title → optional body → brand.
 */
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
/** Left visual column = square slot (full canvas height). */
export const LEFT_SLOT = 630

/** Production URL for the brand icon (fallback when local `public/` copy is missing). */
export const BRAND_ICON_BUILD_URL = 'https://bananasutra.com/android-chrome-512x512.png'

/** Prefer this file at build time — no network required (same asset as shell favicons). */
export const BRAND_ICON_LOCAL_REL = 'public/android-chrome-512x512.png'

let cachedBrandIconBuffer = null

/** Brand icon bytes: local `public/android-chrome-512x512.png` first, then remote. */
export async function loadBrandIconBuffer(rootDir) {
  if (cachedBrandIconBuffer) return cachedBrandIconBuffer
  const localPath = path.join(rootDir, BRAND_ICON_LOCAL_REL)
  if (fs.existsSync(localPath)) {
    cachedBrandIconBuffer = fs.readFileSync(localPath)
    return cachedBrandIconBuffer
  }
  cachedBrandIconBuffer = await fetchUrlBuffer(BRAND_ICON_BUILD_URL)
  return cachedBrandIconBuffer
}

/** Non-song composite in `dist/og/site.png` — keep in sync with `usePageMeta` + `generate-seo-metadata.mjs`. */
export const SITE_OG_CARD_URL = 'https://bananasutra.com/og/site.png'

/** Default large headline on shared `site.png` (home short title). */
export const OG_SITE_DEFAULT_HERO = 'Songs for a World Gone Bananas'

/** Small-type tagline on cards — matches in-app header (sentence case + period). */
export const OG_TAGLINE_SMALL = 'Songs for a world gone bananas.'

/** Home `/` meta description — single shared `site.png` uses this until per-route site OG exists. */
export const SITE_OG_DEFAULT_META_DESCRIPTION =
  'Explore the BANANASUTRA catalog — songs organized by sutra, topic, intention, and sound. Browse songbooks, read lyrics, watch videos, and listen to tracks.'

/** Mirrors `src/catalog/tokens.css` light theme (paper + olive ink). */
export const SITE_OG = {
  paperTop: '#fbf5eb',
  paperMid: '#f4f1e8',
  paperBot: '#e8dfc8',
  ink: '#1e2814',
  inkMuted: '#5c6650',
  inkFaint: '#7a8472',
  accent: '#524a40',
}

const PAPER_PAD_RGB = { r: 244, g: 241, b: 232, alpha: 1 }

/** Wider than ~1.12:1 → treat as horizontal art; center-crop to square. */
const LANDSCAPE_CROP_AR = 1.12

export function siteOgBackground() {
  return `linear-gradient(168deg, ${SITE_OG.paperTop} 0%, ${SITE_OG.paperMid} 45%, ${SITE_OG.paperBot} 100%)`
}

export function loadFonts(rootDir) {
  const sora400Path = path.join(
    rootDir,
    'node_modules/@fontsource/sora/files/sora-latin-400-normal.woff',
  )
  const sora700Path = path.join(
    rootDir,
    'node_modules/@fontsource/sora/files/sora-latin-700-normal.woff',
  )
  const archivoPath = path.join(
    rootDir,
    'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  )
  return {
    sora400: fs.readFileSync(sora400Path),
    sora700: fs.readFileSync(sora700Path),
    archivo: fs.readFileSync(archivoPath),
  }
}

export async function fetchUrlBuffer(url, options = {}) {
  const { timeoutMs = 55000, retries = 2 } = options
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'user-agent': 'BANANASUTRA-og-build/1.0 (+https://bananasutra.com)',
          accept: 'image/*,*/*;q=0.8',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      lastErr = e
      const retryable =
        attempt < retries &&
        (e?.name === 'AbortError' || e?.code === 'ABORT_ERR' || e?.cause?.name === 'AbortError')
      if (retryable) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        continue
      }
      throw e
    } finally {
      clearTimeout(t)
    }
  }
  throw lastErr ?? new Error('fetchUrlBuffer: exhausted retries')
}

/**
 * Normalize any raster into an uncropped square (contain) or centre-cropped square (cover for landscape).
 */
export async function buildLeftSlot630PngBuffer(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width || 1
  const h = meta.height || 1
  const ar = w / h
  const S = LEFT_SLOT
  if (ar >= LANDSCAPE_CROP_AR) {
    return sharp(imageBuffer)
      .resize(S, S, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, effort: 4 })
      .toBuffer()
  }
  return sharp(imageBuffer)
    .resize(S, S, {
      fit: 'contain',
      position: 'centre',
      background: PAPER_PAD_RGB,
    })
    .png({ compressionLevel: 9, effort: 4 })
    .toBuffer()
}

export function bufferToPngDataUrl(buf) {
  return `data:image/png;base64,${buf.toString('base64')}`
}

function truncateLine(text, maxChars) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`
}

/** Same fallback order as `SongDetail` meta description — for OG body copy. */
export function songOgDescriptionFromDetail(detail) {
  const summary = (detail?.lyrics_summary || '').trim()
  if (summary) return summary
  const raw = (detail?.lyrics_extract || '').trim()
  if (!raw) return ''
  const line = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  return (line || '').trim()
}

function normHero(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function taglineNode(marginTop) {
  return {
    type: 'div',
    props: {
      style: {
        fontSize: 15,
        fontFamily: 'Sora',
        fontWeight: 400,
        color: SITE_OG.inkFaint,
        marginTop,
        letterSpacing: '0.02em',
        lineHeight: 1.35,
        maxWidth: 500,
      },
      children: OG_TAGLINE_SMALL,
    },
  }
}

/** Matches site-card kicker (“Ideas you can feel.”) — used as song-card eyebrow for the tagline. */
function eyebrowLineNode(text) {
  return {
    type: 'div',
    props: {
      style: {
        fontSize: 24,
        fontFamily: 'Sora',
        color: SITE_OG.ink,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1.35,
        maxWidth: 500,
      },
      children: text,
    },
  }
}

/** @param {{ bodyFontSize?: number; brandFontSize?: number; urlFontSize?: number }} [typo] */
function typographyColumnChildrenSong(displayTitle, lyricsSummary, typo = {}) {
  const bodyFs = typo.bodyFontSize ?? 22
  const brandFs = typo.brandFontSize ?? 25
  const urlFs = typo.urlFontSize ?? 25
  const title = truncateLine(displayTitle, 42)
  const titleSize = title.length > 30 ? 40 : 48
  const summaryRaw = (lyricsSummary || '').replace(/\s+/g, ' ').trim()
  const summary = summaryRaw ? truncateLine(summaryRaw, 280) : ''
  const out = [
    eyebrowLineNode(OG_TAGLINE_SMALL),
    {
      type: 'div',
      props: {
        style: {
          fontSize: titleSize,
          fontFamily: 'Archivo Black',
          color: SITE_OG.ink,
          lineHeight: 1.08,
          letterSpacing: -0.5,
          maxWidth: 500,
          marginTop: 10,
        },
        children: title,
      },
    },
  ]
  if (summary) {
    out.push({
      type: 'div',
      props: {
        style: {
          fontSize: bodyFs,
          fontFamily: 'Sora',
          fontWeight: 400,
          color: SITE_OG.inkMuted,
          marginTop: 12,
          lineHeight: 1.42,
          maxWidth: 500,
        },
        children: summary,
      },
    })
  }
  out.push({
    type: 'div',
    props: {
      style: {
        fontSize: brandFs,
        fontFamily: 'Sora',
        color: SITE_OG.inkMuted,
        marginTop: 14,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      },
      children: 'BANANASUTRA',
    },
  })
  out.push({
    type: 'div',
    props: {
      style: {
        fontSize: urlFs,
        fontFamily: 'Sora',
        color: SITE_OG.inkFaint,
        marginTop: 6,
        fontWeight: 400,
        letterSpacing: '0.08em',
      },
      children: 'bananasutra.com',
    },
  })
  return out
}

/**
 * @param {{ ideasLine?: string; heroTitle?: string; metaDescription?: string; metaFontSize?: number; brandFontSize?: number; urlFontSize?: number }} p
 */
function typographyColumnChildrenSite(p = {}) {
  const ideasLine = (p.ideasLine ?? 'Ideas you can feel.').trim()
  const heroTitle = (p.heroTitle ?? OG_SITE_DEFAULT_HERO).trim()
  const metaFs = p.metaFontSize ?? 20
  const brandFs = p.brandFontSize ?? 25
  const urlFs = p.urlFontSize ?? 25
  const metaDescription = truncateLine((p.metaDescription ?? SITE_OG_DEFAULT_META_DESCRIPTION).trim(), 240)
  const heroTrunc = truncateLine(heroTitle, 34)
  const hideSmallTagline = normHero(heroTitle) === normHero(OG_SITE_DEFAULT_HERO)

  const out = [
    eyebrowLineNode(ideasLine),
    {
      type: 'div',
      props: {
        style: {
          fontSize: 44,
          fontFamily: 'Archivo Black',
          color: SITE_OG.ink,
          lineHeight: 1.06,
          letterSpacing: -0.5,
          maxWidth: 500,
          marginTop: 10,
        },
        children: heroTrunc,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: metaFs,
          fontFamily: 'Sora',
          fontWeight: 400,
          color: SITE_OG.inkMuted,
          marginTop: 12,
          lineHeight: 1.42,
          maxWidth: 500,
        },
        children: metaDescription,
      },
    },
  ]
  if (!hideSmallTagline) out.push(taglineNode(12))
  out.push({
    type: 'div',
    props: {
      style: {
        fontSize: brandFs,
        fontFamily: 'Sora',
        color: SITE_OG.inkMuted,
        marginTop: hideSmallTagline ? 14 : 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
      },
      children: 'BANANASUTRA',
    },
  })
  out.push({
    type: 'div',
    props: {
      style: {
        fontSize: urlFs,
        fontFamily: 'Sora',
        color: SITE_OG.inkFaint,
        marginTop: 6,
        fontWeight: 400,
        letterSpacing: '0.08em',
      },
      children: 'bananasutra.com',
    },
  })
  return out
}

async function renderCompositeToPng({ fonts, leftDataUrl, rightChildren }) {
  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: SITE_OG.paperMid,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: LEFT_SLOT,
              height: OG_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: SITE_OG.paperMid,
            },
            children: [
              {
                type: 'img',
                props: {
                  src: leftDataUrl,
                  width: LEFT_SLOT,
                  height: LEFT_SLOT,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              background: siteOgBackground(),
              padding: '36px 36px 32px 32px',
              borderLeft: `6px solid ${SITE_OG.accent}`,
            },
            children: rightChildren,
          },
        },
      ],
    },
  }

  const svg = await satori(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: 'Archivo Black', data: fonts.archivo, weight: 400, style: 'normal' },
      { name: 'Sora', data: fonts.sora400, weight: 400, style: 'normal' },
      { name: 'Sora', data: fonts.sora700, weight: 700, style: 'normal' },
    ],
  })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } })
  return resvg.render().asPng()
}

/**
 * @param {{ rootDir: string; displayTitle: string; coverImageUrl: string | null; lyricsSummary?: string | null; fonts?: ReturnType<typeof loadFonts>; songTypography?: { bodyFontSize?: number; brandFontSize?: number; urlFontSize?: number } }} opts
 */
async function loadCoverOrBrandBuffer(rootDir, coverImageUrl) {
  const url = (coverImageUrl || '').trim()
  if (!url) return loadBrandIconBuffer(rootDir)
  try {
    return await fetchUrlBuffer(url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`ogSongCard: cover fetch failed — ${url}\n  ${msg}\n  → using brand icon`)
    return loadBrandIconBuffer(rootDir)
  }
}

export async function renderSongOgToPng(opts) {
  const { rootDir, displayTitle, coverImageUrl, lyricsSummary, fonts: fontsOpt, songTypography } = opts
  const fonts = fontsOpt ?? loadFonts(rootDir)
  const rawBuf = await loadCoverOrBrandBuffer(rootDir, coverImageUrl)
  const leftSlot = await buildLeftSlot630PngBuffer(rawBuf)
  const leftDataUrl = bufferToPngDataUrl(leftSlot)
  const summary = (lyricsSummary || '').trim() || null
  return renderCompositeToPng({
    fonts,
    leftDataUrl,
    rightChildren: typographyColumnChildrenSong(displayTitle, summary, songTypography),
  })
}

/**
 * Single shared `site.png` for non-song routes — defaults match home `/`.
 * Optional copy overrides are for previews / future per-route site cards.
 *
 * @param {{ rootDir: string; fonts?: ReturnType<typeof loadFonts>; ideasLine?: string; heroTitle?: string; metaDescription?: string; siteTypography?: { metaFontSize?: number; brandFontSize?: number; urlFontSize?: number } }} opts
 */
export async function renderSiteOgToPng(opts) {
  const { rootDir, fonts: fontsOpt, ideasLine, heroTitle, metaDescription, siteTypography } = opts
  const fonts = fontsOpt ?? loadFonts(rootDir)
  const rawBuf = await loadBrandIconBuffer(rootDir)
  const leftSlot = await buildLeftSlot630PngBuffer(rawBuf)
  const leftDataUrl = bufferToPngDataUrl(leftSlot)
  return renderCompositeToPng({
    fonts,
    leftDataUrl,
    rightChildren: typographyColumnChildrenSite({
      ideasLine,
      heroTitle,
      metaDescription,
      ...siteTypography,
    }),
  })
}
