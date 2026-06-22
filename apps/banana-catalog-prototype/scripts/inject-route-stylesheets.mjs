/**
 * R59 — inject lazy route CSS as render-blocking <link rel="stylesheet"> into prerendered HTML.
 * Prerender paints full route markup while client lazy() keeps CSS in separate chunks (FOUC).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lazyChunkStemsForRoute } from './route-lazy-chunks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distDir = path.join(root, 'dist')

function fail(msg) {
  console.error(`inject-route-stylesheets: FAIL — ${msg}`)
  process.exit(1)
}

function loadManifest() {
  const candidates = [
    path.join(distDir, '.vite', 'manifest.json'),
    path.join(distDir, 'manifest.json'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'))
    }
  }
  fail('manifest.json missing — set build.manifest: true in vite.config.ts')
}

/** @param {Record<string, { file?: string, css?: string[], imports?: string[] }>} manifest */
function findManifestKeyByStem(manifest, stem) {
  for (const [key, entry] of Object.entries(manifest)) {
    const file = entry.file
    if (file && file.endsWith('.js') && path.basename(file).startsWith(`${stem}-`)) {
      return key
    }
  }
  return null
}

/** @param {Record<string, { file?: string, css?: string[], imports?: string[] }>} manifest */
function collectCssHrefs(manifest, manifestKey, visited = new Set()) {
  if (!manifestKey || visited.has(manifestKey)) return []
  visited.add(manifestKey)
  const entry = manifest[manifestKey]
  if (!entry) return []

  const out = [...(entry.css || [])]
  for (const imp of entry.imports || []) {
    out.push(...collectCssHrefs(manifest, imp, visited))
  }
  return out
}

function walkHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkHtmlFiles(full, out)
    else if (name === 'index.html') out.push(full)
  }
  return out
}

function routeFromHtmlFile(htmlFile) {
  const rel = path.relative(distDir, htmlFile)
  if (rel === 'index.html') return '/'
  const dir = path.dirname(rel)
  return `/${dir.replace(/\\/g, '/')}`
}

function hrefFromStylesheetLink(tag) {
  const match = tag.match(/href="([^"]+)"/i)
  return match ? match[1] : null
}

function existingStylesheetHrefs(html) {
  const hrefs = new Set()
  for (const match of html.matchAll(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"/gi)) {
    hrefs.add(match[1])
  }
  return hrefs
}

function dedupeStylesheetLinks(html) {
  const seen = new Set()
  return html.replace(/<link\s+rel="stylesheet"[^>]*>\s*/gi, (tag) => {
    const href = hrefFromStylesheetLink(tag)
    if (!href || seen.has(href)) return ''
    seen.add(href)
    return tag
  })
}

function moveStylesheetsBeforeModule(html) {
  const moduleScript = html.match(/<script\s+type="module"[^>]*>\s*<\/script>/i)
  if (!moduleScript) return html

  const stylesheetLinks = [...html.matchAll(/<link\s+rel="stylesheet"[^>]*>\s*/gi)].map((m) => m[0])
  if (stylesheetLinks.length === 0) return html

  let stripped = html
  for (const link of stylesheetLinks) {
    stripped = stripped.replace(link, '')
  }

  return stripped.replace(moduleScript[0], `${stylesheetLinks.join('')}${moduleScript[0]}`)
}

function injectStylesheets(html, hrefsToAdd) {
  if (hrefsToAdd.length === 0) return html
  const tags = hrefsToAdd.map((href) => `    <link rel="stylesheet" crossorigin href="${href}">`).join('\n')
  const moduleScript = html.match(/<script\s+type="module"[^>]*>\s*<\/script>/i)
  if (moduleScript) {
    return html.replace(moduleScript[0], `${tags}\n${moduleScript[0]}`)
  }
  return html.replace('</head>', `${tags}\n  </head>`)
}

function main() {
  const manifest = loadManifest()
  const htmlFiles = walkHtmlFiles(distDir)
  let injectedFiles = 0
  let injectedLinks = 0

  for (const htmlFile of htmlFiles) {
    const route = routeFromHtmlFile(htmlFile)
    const stems = lazyChunkStemsForRoute(route)

    let html = fs.readFileSync(htmlFile, 'utf8')
    const original = html

    if (stems.length > 0) {
      const wanted = new Set()
      for (const stem of stems) {
        const key = findManifestKeyByStem(manifest, stem)
        if (!key) {
          fail(`no manifest entry for lazy chunk stem "${stem}" (route ${route})`)
        }
        for (const css of collectCssHrefs(manifest, key)) {
          wanted.add(`/${css.replace(/^\//, '')}`)
        }
      }

      const existing = existingStylesheetHrefs(html)
      const toAdd = [...wanted].filter((href) => !existing.has(href))
      if (toAdd.length > 0) {
        html = injectStylesheets(html, toAdd)
        injectedLinks += toAdd.length
      }
    }

    html = moveStylesheetsBeforeModule(dedupeStylesheetLinks(html))
    if (html !== original) {
      fs.writeFileSync(htmlFile, html, 'utf8')
      injectedFiles += 1
    }
  }

  const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
  if (!/HomePortal-[A-Za-z0-9_-]+\.css/.test(homeHtml)) {
    fail('dist/index.html missing HomePortal stylesheet link after injection')
  }

  console.log(
    `inject-route-stylesheets: added ${injectedLinks} stylesheet link(s) across ${injectedFiles} HTML file(s)`,
  )
}

main()
