/**
 * R24 - after vite build, render each route to dist/.../index.html with full body + head meta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { listPrerenderRoutes } from './prerender-routes.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distDir = path.join(root, 'dist')
const prerenderBatchCli = path.join(root, 'src/prerender/cli-batch.ts')
const prerenderCacheDir = path.join(root, '.prerender-cache')

const CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY || 6)
const PILOT_ONLY = process.env.PRERENDER_PILOT === '1'
const PILOT_ROUTES = new Set([
  '/',
  '/songs',
  '/songs/ego-ain-t-your-amigo',
  '/songbooks/ask-naked-truth',
  '/about/knowsutra',
])

function fail(msg) {
  console.error(`prerender-html: FAIL - ${msg}`)
  process.exit(1)
}

function distPathForRoute(pathname) {
  if (pathname === '/') return path.join(distDir, 'index.html')
  const clean = pathname.replace(/^\//, '')
  return path.join(distDir, clean, 'index.html')
}

function injectHtml(template, { headHtml, bodyHtml }) {
  let html = template
  if (headHtml.trim()) {
    html = html
      .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
      .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '')
      .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '')
      .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
      .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    html = html.replace('</head>', `    ${headHtml}\n  </head>`)
  }
  // Vite 8+ puts module scripts in <head>; match outer #root through its closing tag before </body>.
  html = html.replace(
    /<div id="root">[\s\S]*<\/div>\s*(?=<\/body>)/,
    '<div id="root">' + bodyHtml + '</div>\n  ',
  )
  return html
}

async function mapPool(items, fn, limit) {
  const results = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function cacheKeyForRoute(pathname) {
  if (pathname === '/') return '_index.json'
  return `${pathname.replace(/^\//, '').replace(/\//g, '__')}.json`
}

function renderAllRoutes(routes) {
  fs.rmSync(prerenderCacheDir, { recursive: true, force: true })
  fs.mkdirSync(prerenderCacheDir, { recursive: true })
  const routesFile = path.join(prerenderCacheDir, 'routes.json')
  fs.writeFileSync(routesFile, JSON.stringify(routes), 'utf8')
  const viteNodeBin = path.join(root, 'node_modules', '.bin', 'vite-node')
  if (!fs.existsSync(viteNodeBin)) {
    fail('vite-node not installed — run npm install in apps/banana-catalog-prototype')
  }
  execFileSync(viteNodeBin, [prerenderBatchCli, prerenderCacheDir, routesFile], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 20 * 1024 * 1024,
  })
}

function readRenderedRoute(pathname) {
  const p = path.join(prerenderCacheDir, cacheKeyForRoute(pathname))
  if (!fs.existsSync(p)) fail(`missing prerender cache for ${pathname}`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function main() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    fail('dist/index.html missing — run vite build first')
  }
  const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
  let routes = listPrerenderRoutes()
  if (PILOT_ONLY) routes = routes.filter((r) => PILOT_ROUTES.has(r))

  const started = Date.now()
  console.log(`prerender-html: rendering ${routes.length} routes (single vite-node batch)…`)
  renderAllRoutes(routes)

  await mapPool(
    routes,
    async (route) => {
      const { headHtml, bodyHtml } = readRenderedRoute(route)
      const outPath = distPathForRoute(route)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      const html = injectHtml(template, { headHtml, bodyHtml })
      fs.writeFileSync(outPath, html, 'utf8')
      if (route === '/' || route.endsWith('ego-ain-t-your-amigo')) {
        console.log(`prerender-html: wrote ${route} → ${path.relative(root, outPath)}`)
      }
    },
    CONCURRENCY,
  )
  fs.rmSync(prerenderCacheDir, { recursive: true, force: true })

  const sec = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`prerender-html: done ${routes.length} routes in ${sec}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
