/**
 * R27 — inline critical CSS into prerendered HTML (runs after prerender-html.mjs).
 * R35 — preload: false keeps full stylesheet render-blocking (no media=print FOUC).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Beasties from 'beasties'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distDir = path.join(root, 'dist')

function walkHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkHtmlFiles(full, out)
    else if (name === 'index.html') out.push(full)
  }
  return out
}

const beasties = new Beasties({
  path: distDir,
  publicPath: '/',
  preload: false,
  pruneSource: false,
})

const files = walkHtmlFiles(distDir)
let ok = 0
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8')
  const inlined = await beasties.process(html)
  fs.writeFileSync(file, inlined, 'utf8')
  ok += 1
}

console.log(`inline-critical-css: updated ${ok} HTML file(s) under dist/`)
