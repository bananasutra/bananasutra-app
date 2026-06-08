/**
 * W-074 — GitHub Pages static redirect HTML at legacy About hub paths.
 * Run after prerender-html.mjs (writes into dist/).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalPathForRoute } from './seo-canonical-path.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '../dist')

/** Legacy nested paths → flat canonical targets (D-043). */
const LEGACY_ABOUT_HUB_REDIRECTS = [
  { from: '/about/sutras', to: canonicalPathForRoute('/sutras') },
  { from: '/about/muses', to: canonicalPathForRoute('/muses') },
  { from: '/about/quotes', to: canonicalPathForRoute('/quotes') },
]

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

  for (const { from, to } of LEGACY_ABOUT_HUB_REDIRECTS) {
    const outPath = distPathForRoute(from)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, redirectHtml(to), 'utf8')
    console.log(`generate-route-redirects: ${from} → ${to}`)
  }
}

main()
