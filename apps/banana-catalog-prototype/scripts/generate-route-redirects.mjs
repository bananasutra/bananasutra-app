/**
 * W-074 — GitHub Pages static redirect HTML at legacy About paths.
 * Run after prerender-html.mjs (writes into dist/).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalPathForRoute } from './seo-canonical-path.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '../dist')
const sutraContextPath = path.join(__dirname, '../src/data/generated/sutra_context.json')

/** Legacy nested paths → flat canonical targets (D-043). */
const LEGACY_ABOUT_HUB_REDIRECTS = [
  { from: '/about/sutras', to: canonicalPathForRoute('/sutras') },
  { from: '/about/muses', to: canonicalPathForRoute('/muses') },
  { from: '/about/quotes', to: canonicalPathForRoute('/quotes') },
]

function listLegacySutraDetailRedirects() {
  const sutraContext = JSON.parse(fs.readFileSync(sutraContextPath, 'utf8'))
  const out = []
  for (const key of Object.keys(sutraContext)) {
    const slug = (sutraContext[key].url_slug_sutra || '').trim().toLowerCase()
    if (!slug) continue
    out.push({ from: `/about/${slug}`, to: canonicalPathForRoute(`/sutras/${slug}`) })
  }
  return out
}

function redirectHtml(target) {
  return `<!DOCTYPE html>
<meta charset="utf-8">
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>window.location.replace('${target}')</script>
`
}

function distPathForRoute(pathname) {
  const clean = pathname.replace(/^\//, '')
  return path.join(distDir, clean, 'index.html')
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('generate-route-redirects: dist/ missing — run vite build first')
    process.exit(1)
  }

  const redirects = [...LEGACY_ABOUT_HUB_REDIRECTS, ...listLegacySutraDetailRedirects()]

  for (const { from, to } of redirects) {
    const outPath = distPathForRoute(from)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, redirectHtml(to), 'utf8')
    console.log(`generate-route-redirects: ${from} → ${to}`)
  }
}

main()
