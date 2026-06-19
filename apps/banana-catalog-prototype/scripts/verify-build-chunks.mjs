/**
 * Post-`vite build` guardrail for production chunk layout.
 *
 * Catches Rolldown graphs where lazy route chunks import the entry `index-*.js`
 * bundle (circular dep → dynamic import() fails → prerender HTML with no component CSS).
 *
 * Run after `vite build` (wired into `npm run build` and CI).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const assetsDir = path.join(root, 'dist', 'assets')

/** Broken stage deploy had 1 extracted CSS asset; healthy builds have many route chunks. */
const MIN_CSS_ASSETS = 5

/** Home route lazy chunk — must not import entry index (stage CSS outage root cause). */
const CRITICAL_LAZY_STEMS = ['HomePortal']

/** If a new app-root feature pulls shared catalog utils into index, add manualChunks in
 *  vite.config.ts (see README § Stage deploy lessons learned 2026-06-19). */

const INDEX_IMPORT_RE = /from"\.\/index-[^"]+\.js"/

function fail(msg) {
  console.error(`verify-build-chunks: FAIL — ${msg}`)
  process.exit(1)
}

function warn(msg) {
  console.warn(`verify-build-chunks: WARN — ${msg}`)
}

function ok(msg) {
  console.log(`verify-build-chunks: OK — ${msg}`)
}

function chunkStem(filename) {
  return filename.replace(/-[A-Za-z0-9_-]+\.js$/, '')
}

function readAssetsDir() {
  if (!fs.existsSync(assetsDir)) {
    fail('dist/assets/ missing — run `vite build` first')
  }
  return fs.readdirSync(assetsDir)
}

function findEntryIndexBundle(files) {
  const matches = files.filter((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f))
  if (matches.length !== 1) {
    fail(`expected exactly one index-*.js entry bundle, found ${matches.length}: ${matches.join(', ') || '(none)'}`)
  }
  return matches[0]
}

/** Lazy factories look like: lazy)(()=>i(()=>import(`./HomePortal-HASH.js`) */
function lazyRouteChunkBasenames(indexSource) {
  const names = new Set()
  const re = /lazy\)\(\(\)=>[a-z]\(\(\)=>import\(`\.\/([^`]+\.js)`\)/g
  for (const match of indexSource.matchAll(re)) {
    names.add(match[1])
  }
  if (names.size === 0) {
    fail('no lazy route imports found in entry bundle — update verify-build-chunks.mjs if App.tsx lazy pattern changed')
  }
  return [...names]
}

function resolveChunkFile(files, basename) {
  if (files.includes(basename)) return basename
  const stem = basename.replace(/-[A-Za-z0-9_-]+\.js$/, '')
  const matches = files.filter((f) => f.startsWith(`${stem}-`) && f.endsWith('.js'))
  if (matches.length === 1) return matches[0]
  fail(`could not resolve lazy chunk file for ${basename} (candidates: ${matches.join(', ') || 'none'})`)
}

function main() {
  const files = readAssetsDir()
  const indexFile = findEntryIndexBundle(files)
  const indexSource = fs.readFileSync(path.join(assetsDir, indexFile), 'utf8')

  const cssCount = files.filter((f) => f.endsWith('.css')).length
  if (cssCount < MIN_CSS_ASSETS) {
    fail(`only ${cssCount} CSS asset(s) in dist/assets (need ≥ ${MIN_CSS_ASSETS}) — lazy route styles likely not emitted`)
  }

  if (!files.some((f) => /^jsx-runtime-[A-Za-z0-9_-]+\.js$/.test(f))) {
    fail('missing jsx-runtime-*.js chunk — check vite.config.ts manualChunks (CSS preload helper layout)')
  }
  if (!files.some((f) => /^react-router-[A-Za-z0-9_-]+\.js$/.test(f))) {
    fail('missing react-router-*.js chunk — check vite.config.ts manualChunks')
  }
  if (!indexSource.includes('from"./jsx-runtime-')) {
    fail(`${indexFile} does not import jsx-runtime chunk`)
  }

  const lazyBasenames = lazyRouteChunkBasenames(indexSource)
  const criticalCircular = []
  const otherCircular = []

  for (const basename of lazyBasenames) {
    const chunkFile = resolveChunkFile(files, basename)
    const chunkSource = fs.readFileSync(path.join(assetsDir, chunkFile), 'utf8')
    if (!INDEX_IMPORT_RE.test(chunkSource)) continue
    if (CRITICAL_LAZY_STEMS.includes(chunkStem(chunkFile))) {
      criticalCircular.push(chunkFile)
    } else {
      otherCircular.push(chunkFile)
    }
  }

  if (criticalCircular.length > 0) {
    fail(
      `critical lazy chunk(s) import entry bundle ${indexFile} (circular dep on first paint): ${criticalCircular.join(', ')}`,
    )
  }

  if (otherCircular.length > 0) {
    warn(
      `${otherCircular.length} other lazy chunk(s) still import ${indexFile} (usually OK after bootstrap; consider splitting later): ${otherCircular.join(', ')}`,
    )
  }

  ok(
    `${indexFile}; ${lazyBasenames.length} lazy routes; ${cssCount} CSS assets; jsx-runtime + react-router chunks present`,
  )
}

main()
