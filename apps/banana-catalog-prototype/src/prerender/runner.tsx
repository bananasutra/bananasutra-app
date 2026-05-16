/**
 * R24 — render one route to HTML string (Node + happy-dom).
 * Invoked by `scripts/prerender-html.mjs` via `vite-node` (batch in `cli-batch.ts`).
 */
import React from 'react'
import { Window } from 'happy-dom'
import { renderToString } from 'react-dom/server'
import type { HelmetServerState } from 'react-helmet-async'
import { HelmetProvider } from 'react-helmet-async'
import { AppPrerender } from './AppPrerender'
import { loadSeededCatalogData } from './seedCatalogCaches'
import { seedBuildTimeCatalogCaches } from '../catalog/generatedData'

export type RenderRouteResult = {
  bodyHtml: string
  headHtml: string
}

/** React 19 hoists metadata in the client but leaves tags in SSR HTML; peel them for static <head>. */
const HEAD_TAG_RE =
  /^(<title[\s\S]*?<\/title>|<meta\s[\s\S]*?\/?>|<link\s[\s\S]*?\/?>|<script\s+type="application\/ld\+json"[\s\S]*?<\/script>)\s*/i

function splitHeadFromBody(html: string): { headHtml: string; bodyHtml: string } {
  const headParts: string[] = []
  let rest = html
  for (;;) {
    const m = rest.match(HEAD_TAG_RE)
    if (!m) break
    headParts.push(m[1])
    rest = rest.slice(m[0].length)
  }
  return { headHtml: headParts.join('\n'), bodyHtml: rest }
}

let seeded = false

let domWindow: Window | null = null

function ensureDom(url: string) {
  if (domWindow) return
  domWindow = new Window({
    url,
    settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  })
  const g = globalThis as typeof globalThis & {
    window?: Window
    document?: Document
  }
  Object.defineProperty(g, 'window', { value: domWindow, configurable: true })
  Object.defineProperty(g, 'document', { value: domWindow.document, configurable: true })
}

function ensureCatalogSeeded() {
  if (seeded) return
  const data = loadSeededCatalogData()
  seedBuildTimeCatalogCaches({
    songCatalog: data.songCatalog,
    songCatalogBrowse: data.songCatalogBrowse,
    songDetail: data.songDetail,
    songSearchDeep: data.songSearchDeep,
    muses: data.muses,
    quotes: data.quotes,
    youtubeByLyricsId: data.youtubeByLyricsId,
  })
  seeded = true
}

export function renderRoute(pathname: string, origin = 'https://bananasutra.com'): RenderRouteResult {
  const url = `${origin}${pathname === '/' ? '/' : pathname}`
  ensureDom(url)
  ensureCatalogSeeded()

  const helmetContext: { helmet?: HelmetServerState } = {}
  const bodyHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <AppPrerender location={pathname} />
    </HelmetProvider>,
  )

  const helmet = helmetContext.helmet
  const helmetHead = helmet
    ? [
        helmet.title.toString(),
        helmet.meta.toString(),
        helmet.link.toString(),
        helmet.script.toString(),
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  const { headHtml: react19Head, bodyHtml: bodyWithoutHead } = splitHeadFromBody(bodyHtml)
  const headHtml = [helmetHead, react19Head].filter(Boolean).join('\n')
  const cleanedBody = bodyWithoutHead
    .replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
    .replace(/<link\s+rel="preload"[^>]*\/?>\s*/gi, '')

  return { bodyHtml: cleanedBody, headHtml }
}
