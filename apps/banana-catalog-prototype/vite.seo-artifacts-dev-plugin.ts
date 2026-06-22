/**
 * Dev-only: serve build-time SEO artifacts at production URLs (`/feed.xml`, `/llms.txt`).
 * `npm run dev` has no `dist/` by default; without this middleware those paths hit SPA → 404.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const SEO_ARTIFACT_ROUTES = {
  '/feed.xml': {
    script: 'generate-feed.mjs',
    contentType: 'application/atom+xml; charset=utf-8',
  },
  '/llms.txt': {
    script: 'generate-llms-txt.mjs',
    contentType: 'text/plain; charset=utf-8',
  },
} as const

type SeoArtifactPath = keyof typeof SEO_ARTIFACT_ROUTES

export function seoArtifactsDevPlugin(appRoot: string): Plugin {
  const distDir = path.join(appRoot, 'dist')
  const scriptsDir = path.join(appRoot, 'scripts')

  function ensureArtifact(pathname: SeoArtifactPath): string | null {
    const spec = SEO_ARTIFACT_ROUTES[pathname]
    const outFile = path.join(distDir, pathname.slice(1))

    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true })
    }

    try {
      execFileSync(process.execPath, [path.join(scriptsDir, spec.script)], {
        cwd: appRoot,
        stdio: 'pipe',
      })
    } catch {
      return null
    }

    return fs.existsSync(outFile) ? outFile : null
  }

  function serveArtifact(
    pathname: SeoArtifactPath,
    res: import('node:http').ServerResponse,
    next: (err?: unknown) => void,
  ) {
    const spec = SEO_ARTIFACT_ROUTES[pathname]
    const outFile = ensureArtifact(pathname)
    if (!outFile) {
      next()
      return
    }
    res.setHeader('Content-Type', spec.contentType)
    fs.createReadStream(outFile).pipe(res).on('error', next)
  }

  return {
    name: 'seo-artifacts-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url?.split('?')[0] ?? '') as SeoArtifactPath
        if (!(pathname in SEO_ARTIFACT_ROUTES)) {
          next()
          return
        }
        serveArtifact(pathname, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url?.split('?')[0] ?? '') as SeoArtifactPath
        if (!(pathname in SEO_ARTIFACT_ROUTES)) {
          next()
          return
        }
        const outFile = path.join(distDir, pathname.slice(1))
        if (fs.existsSync(outFile)) {
          const spec = SEO_ARTIFACT_ROUTES[pathname]
          res.setHeader('Content-Type', spec.contentType)
          fs.createReadStream(outFile).pipe(res).on('error', next)
          return
        }
        serveArtifact(pathname, res, next)
      })
    },
  }
}
