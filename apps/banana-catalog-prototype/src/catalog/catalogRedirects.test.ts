import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRedirectPathname, resolveCatalogRedirect } from './catalogRedirects'

test('normalizeRedirectPathname trims trailing slash', () => {
  assert.equal(normalizeRedirectPathname('/songs/foo/'), '/songs/foo')
  assert.equal(normalizeRedirectPathname('/'), '/')
})

test('resolveCatalogRedirect maps renamed song slug', () => {
  assert.equal(
    resolveCatalogRedirect('/songs/the-seven-sutras-of-banana'),
    '/songs/seven-sutras-gone-banana/',
  )
  assert.equal(
    resolveCatalogRedirect('/songs/the-seven-sutras-of-banana/'),
    '/songs/seven-sutras-gone-banana/',
  )
  assert.equal(resolveCatalogRedirect('/songs/unknown-slug'), null)
})
