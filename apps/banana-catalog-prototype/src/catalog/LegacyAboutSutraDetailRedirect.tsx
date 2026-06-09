import { Navigate, useParams } from 'react-router-dom'
import { canonicalPathForRoute } from './seoPaths'
import { sutraDetailPath } from './songPaths'

/** W-074 — legacy `/about/:slug` sutra detail bookmarks → flat `/sutras/:slug/`. */
export function LegacyAboutSutraDetailRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const trimmed = (slug ?? '').trim().toLowerCase()
  const to = trimmed ? sutraDetailPath(trimmed) : canonicalPathForRoute('/sutras')
  return <Navigate to={to} replace />
}
