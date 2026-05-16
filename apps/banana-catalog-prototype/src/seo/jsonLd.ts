import type { SongDetailRecord } from '../catalog/types'
import { padMetaDescription } from '../catalog/pageMetaConstants'

const SITE_URL = 'https://bananasutra.com'
const LYRICS_SNIPPET_MAX = 800

function truncateLyrics(text: string): string {
  const t = text.trim()
  if (t.length <= LYRICS_SNIPPET_MAX) return t
  return `${t.slice(0, LYRICS_SNIPPET_MAX).trimEnd()}…`
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BANANASUTRA',
    url: SITE_URL,
    description:
      'Songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/songs?find={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function songRecordingJsonLd(
  detail: SongDetailRecord,
  canonicalSlug: string,
  options?: { songbookTitle?: string },
): Record<string, unknown> {
  const url = `${SITE_URL}/songs/${canonicalSlug}`
  const lyricsRaw = (detail.lyrics_extract || '').trim()
  const firstTrack = detail.tracks?.[0]
  const genres = [
    ...new Set(
      [
        firstTrack?.primary_genre,
        ...(firstTrack?.secondary_genres ?? []),
        ...(firstTrack?.genres ?? []),
      ].filter((g): g is string => Boolean(g)),
    ),
  ]

  const recordingOf: Record<string, unknown> = {
    '@type': 'MusicComposition',
    name: detail.lyrics_title,
    composer: { '@type': 'Person', name: 'BANANASUTRA' },
  }
  if (lyricsRaw) {
    recordingOf.lyrics = {
      '@type': 'CreativeWork',
      text: truncateLyrics(lyricsRaw),
    }
  }

  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: detail.lyrics_title,
    url,
    description: (() => {
      const s = (detail.lyrics_summary || '').trim()
      return s ? padMetaDescription(s) : undefined
    })(),
    datePublished: (firstTrack?.created_at || '').trim().slice(0, 10) || undefined,
    byArtist: {
      '@type': 'MusicGroup',
      name: 'BANANASUTRA',
      url: `${SITE_URL}/about`,
    },
    recordingOf,
    image: `${SITE_URL}/og/songs/${canonicalSlug}.png`,
  }

  if (genres.length) out.genre = genres
  if (options?.songbookTitle) {
    out.inAlbum = { '@type': 'MusicAlbum', name: options.songbookTitle }
  }

  return out
}

export function musicAlbumJsonLd(
  songbookTitle: string,
  slug: string,
  description: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: songbookTitle,
    url: `${SITE_URL}/songbooks/${slug}`,
    description: description.trim() || `${songbookTitle} — a curated BANANASUTRA songbook.`,
    byArtist: {
      '@type': 'MusicGroup',
      name: 'BANANASUTRA',
      url: `${SITE_URL}/about`,
    },
  }
}

export function songbookItemListJsonLd(
  songbookTitle: string,
  slug: string,
  songTitles: string[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: songbookTitle,
    url: `${SITE_URL}/songbooks/${slug}`,
    itemListElement: songTitles.slice(0, 50).map((name, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'MusicRecording', name },
    })),
  }
}

export function sutraCreativeWorkJsonLd(
  familyKey: string,
  slug: string,
  description?: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: `${familyKey} · Sutra`,
    url: `${SITE_URL}/about/${slug}`,
    description:
      description?.trim() ||
      `Explore the ${familyKey} sutra — songs, featured video, and related songbooks.`,
    author: { '@type': 'Organization', name: 'BANANASUTRA' },
  }
}
