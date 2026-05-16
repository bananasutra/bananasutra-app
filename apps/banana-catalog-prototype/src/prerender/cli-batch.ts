/**
 * R24 — render many routes in one vite-node process (avoids 444× npm exec).
 * Usage: vite-node src/prerender/cli-batch.ts <outDir> <routes.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { renderRoute } from './runner'

const outDir = process.argv[2]
const routesFile = process.argv[3]
if (!outDir || !routesFile) {
  console.error('usage: cli-batch.ts <outDir> <routes.json>')
  process.exit(1)
}

const routes: string[] = JSON.parse(fs.readFileSync(routesFile, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

function cacheKey(pathname: string) {
  if (pathname === '/') return '_index.json'
  return `${pathname.replace(/^\//, '').replace(/\//g, '__')}.json`
}

for (const pathname of routes) {
  const result = renderRoute(pathname)
  fs.writeFileSync(path.join(outDir, cacheKey(pathname)), JSON.stringify(result), 'utf8')
  process.stderr.write(`prerender: ${pathname}\n`)
}
