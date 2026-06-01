import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import type { SongbookCatalogItem } from './types'
import { songbookCatalogPath } from './songPaths'
import { songbookToUrlSlug } from './slugify'

const songbookCatalog = songbookCatalogJson as SongbookCatalogItem[]

type SongbookWithSlug = SongbookCatalogItem & { slug: string }

const withSlug: SongbookWithSlug[] = songbookCatalog.map((b) => ({
  ...b,
  slug: (b.url_slug_songbook || '').trim() || songbookToUrlSlug(b.songbook),
}))

const bySlug = new Map<string, SongbookWithSlug>()
const byName = new Map<string, SongbookWithSlug>()
for (const b of withSlug) {
  if (!bySlug.has(b.slug)) bySlug.set(b.slug, b)
  if (!byName.has(b.songbook)) byName.set(b.songbook, b)
}

export function allSongbooks(): SongbookWithSlug[] {
  return withSlug
}

export function songbookBySlug(slug: string): SongbookWithSlug | undefined {
  return bySlug.get(slug)
}

export function songbookByName(name: string): SongbookWithSlug | undefined {
  return byName.get(name)
}

export function songbookHref(name: string): string {
  const known = songbookByName(name)
  const slug = known?.slug ?? songbookToUrlSlug(name)
  return songbookCatalogPath(slug)
}

export function songbooksBrowseHref(findQuery?: string): string {
  const trimmed = (findQuery ?? '').trim()
  if (!trimmed) return '/songbooks'
  return `/songbooks?find=${encodeURIComponent(trimmed)}`
}
