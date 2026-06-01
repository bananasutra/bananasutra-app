import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { pickFeaturedSongbook, songbookFeaturedKickerLabel, songbookHrefFromCatalogItem } from './homePortalUtils'
import { allSongbooks, songbookHref, songbooksBrowseHref } from './songbooks'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalogBrowse } from './generatedData'
import { filterSongsByAlbumSearchQuery, searchTokens } from './searchMatch'
import type { SongbookCatalogItem } from './types'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import './CatalogApp.css'
import './SongbooksPage.css'

function byPopularityScore(songbook: {
  playlist_total_plays: number
  playlist_total_likes: number
  songs_with_in_app_playback: number
}): number {
  return songbook.playlist_total_plays + 40 * songbook.playlist_total_likes + songbook.songs_with_in_app_playback
}

type SongbookSectionKey = 'sutra' | 'collection' | 'genre' | 'language' | 'other'

/** Primary sections top-to-bottom; Collections last per IA. */
const SECTION_ORDER: SongbookSectionKey[] = ['sutra', 'genre', 'language', 'collection', 'other']

const SUTRA_CORE_ORDER = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW'] as const

/** Sort sutra subsections: cores → OTHER → QUACK (bottom). */
const SUBSECTION_ORDER_INDEX: Record<string, number> = Object.fromEntries([
  ...SUTRA_CORE_ORDER.map((k, i) => [k, i] as const),
  ['OTHER', SUTRA_CORE_ORDER.length],
  ['QUACK', SUTRA_CORE_ORDER.length + 1],
])

type ListedSongbook = ReturnType<typeof allSongbooks>[number]

const SECTION_COPY: Record<
  Exclude<SongbookSectionKey, ''>,
  { title: string; intro: string }
> = {
  sutra: {
    title: 'Sutra songbooks',
    intro: 'Curated series aligned with a primary sutra, meaning-first listening paths through the catalog.',
  },
  collection: {
    title: 'Collections',
    intro: 'Cross-cutting sets: entry points, favorites, and other editorial bundles that are not tied to one sutra lane.',
  },
  genre: {
    title: 'Genre best-ofs',
    intro: 'SoundCloud “best of” playlists by genre. Same songs may appear across sets; use for listening, not as a second catalog index.',
  },
  language: {
    title: 'Language & world',
    intro: 'Sets grouped by language or global / world framing.',
  },
  other: {
    title: 'Songbooks',
    intro: 'Additional in-app songbooks (type not set on the source row).',
  },
}

const SECTION_MOBILE_LABELS: Partial<Record<SongbookSectionKey, string>> = {
  sutra: 'Sutras',
  genre: 'Genres',
  language: 'Language',
  collection: 'Collections',
}

const SONGBOOK_CARD_ART_REQUEST_WIDTH = 480
const SONGBOOK_CARD_ART_SIZES = '(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 260px'
const SONGBOOK_FILTER_KEYS = ['find', 'type', 'sutra', 'topic'] as const

type SongbooksFilterKey = (typeof SONGBOOK_FILTER_KEYS)[number]

function sectionKeyForType(raw: string | undefined): SongbookSectionKey {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'sutra' || t === 'collection' || t === 'genre' || t === 'language') return t
  return 'other'
}

/** Group sutra-type songbooks under a primary sutra key; QUACK lands in its own subsection at the end. */
function primarySutraKeyForGrouping(book: ListedSongbook): string {
  const rollup = (book.sutra_id_rollup || '').trim()
  if (rollup) {
    const tail = rollup.split('-').pop() || ''
    const up = tail.toUpperCase()
    if (up === 'QUACK') return 'QUACK'
    for (const k of SUTRA_CORE_ORDER) {
      if (up === k) return k
    }
  }
  const raw = book.sutras || ''
  for (const token of raw.split(',')) {
    const t = token.trim().toUpperCase()
    if (t.startsWith('QUACK')) return 'QUACK'
    for (const k of SUTRA_CORE_ORDER) {
      if (t.startsWith(k)) return k
    }
  }
  return 'OTHER'
}

function sutraSubsectionLabel(key: string): string {
  if (key === 'OTHER') return 'Other'
  if (key === 'QUACK') return 'QUACKsutra'
  return `${key}sutra`
}

function sortBooks(a: ListedSongbook, b: ListedSongbook): number {
  return byPopularityScore(b) - byPopularityScore(a) || a.songbook.localeCompare(b.songbook)
}

function splitFacetValues(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitFacetValuesUpper(raw: string): string[] {
  return splitFacetValues(raw).map((part) => part.toUpperCase())
}

function songbookMatchesFindFallback(book: ListedSongbook, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const memberText = book.member_songs
    .map((song) => `${song.lyrics_title} ${song.summary_short}`)
    .join(' ')
    .toLowerCase()
  const haystack = [
    book.songbook,
    book.description,
    book.sutras,
    book.secondary_sutra,
    book.topics_primary,
    memberText,
  ]
    .join(' ')
    .toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

function gridClassForSection(sectionKey: SongbookSectionKey): string {
  const base = 'songbooks-page__grid'
  if (sectionKey === 'sutra') return `${base} ${base}--sutra`
  if (sectionKey === 'collection') return `${base} ${base}--pairs`
  return `${base} ${base}--triple`
}

/** Short intro blurbs under each sutra lane heading on the songbooks page. */
const SUTRA_INTROS: Record<string, string> = {
  KNOW:
    '"Is it true?" Questions that matter. Fact-check the universe, call out the paradoxes, and choose peace. This is where clarity begins.',
  BLOW:
    '"Is it fair?" The shadow realm where we name the foul play and choose to speak up. Loud, necessary, and yes, it stinks. Antidote: SHOW or FLOW.',
  QUACK:
    '"Is it foul?" BLOW\'s unruly sub-sutra. Mock the grotesque quacks, name the shady ducks, make America constitutional again, alright?...',
  SHOW:
    '"Is it fun?" The emergency joy valve. Absurdity as medicine, holy fools on stage. Angels fly because they take themselves lightly. Hope is dope.',
  GROW:
    '"Is it brave?" Where we dare to care out loud. Empathy over hypocrisy, clarity over superficiality, win-win over zero-sum. Find your coconuts.',
  FLOW:
    '"Is it free?" Breathe deeper, slower. Learn to trust, intimately. Songs for when you\'re trying too hard and need to let the river do the work.',
  GLOW:
    '"Is it full?" Gratitude with grit. The sheer poetry of being human and alive. Think rainbows, puppies, ocean breeze, a hot beverage... Happiness is simple.',
  BOW:
    '"Is it awe?" Where grace meets gravity. We\'re tiny specks in a sea of stars, and love is so mighty even death is nothing at all.',
}

function sutraIntroForKey(key: string): string | null {
  return SUTRA_INTROS[key] ?? null
}

function SongbookCard({ book }: { book: ListedSongbook }) {
  return (
    <Link className="songbooks-page__card" to={songbookHref(book.songbook)}>
      <div className="songbooks-page__media">
        {book.playlist_artwork_url ? (
          <img
            className="songbooks-page__art"
            srcSet={buildSrcset(book.playlist_artwork_url, [240, 360, SONGBOOK_CARD_ART_REQUEST_WIDTH, 640])}
            sizes={SONGBOOK_CARD_ART_SIZES}
            src={coverImageUrl(book.playlist_artwork_url, { width: SONGBOOK_CARD_ART_REQUEST_WIDTH })}
            alt=""
            width={280}
            height={280}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="songbooks-page__art songbooks-page__art--fallback" aria-hidden>
            🍌
          </div>
        )}
      </div>
      <div className="songbooks-page__body">
        <h3 className="songbooks-page__title">{book.songbook}</h3>
        {book.description ? <p className="songbooks-page__desc">{book.description}</p> : null}
        <SongbookPlaylistMetaLine book={book} />
      </div>
    </Link>
  )
}

export function SongbooksPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { key: routeVisitKey } = useLocation()
  const [searchParams] = useSearchParams()
  const { data: songCatalogRows } = useSongCatalogBrowse()
  const [featuredSongbook, setFeaturedSongbook] = useState<SongbookCatalogItem | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('../data/generated/songbook_catalog.json').then((m) => {
      if (cancelled) return
      const books = (m.default as SongbookCatalogItem[]) ?? []
      startTransition(() => setFeaturedSongbook(pickFeaturedSongbook(books)))
    })
    return () => {
      cancelled = true
    }
  }, [routeVisitKey])

  const pageMeta = renderPageMeta({
    title: 'Songbooks & Playlists',
    description: 'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
    path: canonicalPathForRoute('/songbooks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  const songCatalog = useMemo(() => songCatalogRows ?? [], [songCatalogRows])
  const songbooks = useMemo(() => [...allSongbooks()].sort(sortBooks), [])
  const findQuery = (searchParams.get('find') ?? '').trim()
  const typeFilterRaw = (searchParams.get('type') ?? '').trim().toLowerCase()
  const sutraFilter = (searchParams.get('sutra') ?? '').trim().toUpperCase()
  const topicFilter = (searchParams.get('topic') ?? '').trim().toUpperCase()
  const findTokens = useMemo(() => searchTokens(findQuery), [findQuery])
  const typeFilter =
    typeFilterRaw && SECTION_ORDER.includes(typeFilterRaw as SongbookSectionKey) ? (typeFilterRaw as SongbookSectionKey) : ''

  const songbookMatchesFromDiscoveryFind = useMemo(() => {
    if (!findTokens.length || songCatalog.length === 0) return new Set<string>()
    const songs = filterSongsByAlbumSearchQuery(songCatalog, findQuery)
    return new Set(
      songs
        .map((song) => (song.songbook || '').trim())
        .filter(Boolean),
    )
  }, [findTokens, songCatalog, findQuery])

  const typeFacetOptions = useMemo(() => {
    const byType = new Map<SongbookSectionKey, number>()
    for (const key of SECTION_ORDER) byType.set(key, 0)
    for (const book of songbooks) {
      const key = sectionKeyForType(book.songbook_type)
      byType.set(key, (byType.get(key) ?? 0) + 1)
    }
    return SECTION_ORDER.map((key) => ({
      key,
      label: SECTION_COPY[key].title,
      count: byType.get(key) ?? 0,
    })).filter((option) => option.count > 0)
  }, [songbooks])

  const sutraFacetOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of songbooks) {
      const labels = new Set([...splitFacetValuesUpper(book.sutras), ...splitFacetValuesUpper(book.secondary_sutra)])
      for (const label of labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        const orderValue = (key: string) => {
          if (key === 'QUACKSUTRA') return SUTRA_CORE_ORDER.length + 1
          if (key.endsWith('SUTRA')) {
            const stem = key.replace(/SUTRA$/, '')
            const coreIndex = SUTRA_CORE_ORDER.indexOf(stem as (typeof SUTRA_CORE_ORDER)[number])
            if (coreIndex >= 0) return coreIndex
          }
          return 99
        }
        const oa = orderValue(a.value)
        const ob = orderValue(b.value)
        if (oa !== ob) return oa - ob
        return a.value.localeCompare(b.value)
      })
  }, [songbooks])

  const topicFacetOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of songbooks) {
      const labels = new Set(splitFacetValuesUpper(book.topics_primary))
      for (const label of labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  }, [songbooks])
  const visibleTopicFacetOptions = useMemo(() => {
    const base = topicFacetOptions.slice(0, 24)
    if (!topicFilter || base.some((option) => option.value === topicFilter)) return base
    const active = topicFacetOptions.find((option) => option.value === topicFilter)
    return active ? [...base, active] : base
  }, [topicFacetOptions, topicFilter])

  const filteredSongbooks = useMemo(() => {
    return songbooks.filter((book) => {
      if (typeFilter && sectionKeyForType(book.songbook_type) !== typeFilter) return false
      if (sutraFilter) {
        const sutraTokens = new Set([...splitFacetValuesUpper(book.sutras), ...splitFacetValuesUpper(book.secondary_sutra)])
        if (!sutraTokens.has(sutraFilter)) return false
      }
      if (topicFilter) {
        const topicTokens = new Set(splitFacetValuesUpper(book.topics_primary))
        if (!topicTokens.has(topicFilter)) return false
      }
      if (!findTokens.length) return true
      if (songbookMatchesFromDiscoveryFind.has(book.songbook.trim())) return true
      return songbookMatchesFindFallback(book, findTokens)
    })
  }, [songbooks, typeFilter, sutraFilter, topicFilter, findTokens, songbookMatchesFromDiscoveryFind])

  const hasActiveFilters = Boolean(findQuery || typeFilter || sutraFilter || topicFilter)
  const songbooksPath = canonicalPathForRoute('/songbooks')
  const buildFilterHref = (next: Partial<Record<SongbooksFilterKey, string | null>>): string => {
    const merged = new URLSearchParams(searchParams.toString())
    for (const key of SONGBOOK_FILTER_KEYS) {
      if (!(key in next)) continue
      const value = (next[key] ?? '').trim()
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    const qs = merged.toString()
    return qs ? `${songbooksPath}?${qs}` : songbooksPath
  }

  const sections = useMemo(() => {
    const bySection = new Map<SongbookSectionKey, ListedSongbook[]>()
    for (const key of SECTION_ORDER) bySection.set(key, [])
    for (const book of filteredSongbooks) {
      const key = sectionKeyForType(book.songbook_type)
      const group = bySection.get(key)
      if (group) group.push(book)
      else bySection.set(key, [book])
    }

    return SECTION_ORDER.map((sectionKey) => {
      const books = [...(bySection.get(sectionKey) ?? [])].sort(sortBooks)
      const copy = SECTION_COPY[sectionKey]
      if (sectionKey === 'sutra' && books.length > 0) {
        const bySub = new Map<string, ListedSongbook[]>()
        for (const b of books) {
          const sk = primarySutraKeyForGrouping(b)
          if (!bySub.has(sk)) bySub.set(sk, [])
          bySub.get(sk)!.push(b)
        }
        const subsections = [...bySub.entries()]
          .map(([sutraKey, list]) => ({
            sutraKey,
            label: sutraSubsectionLabel(sutraKey),
            books: list.sort(sortBooks),
          }))
          .sort((a, b) => {
            const ia = SUBSECTION_ORDER_INDEX[a.sutraKey] ?? 99
            const ib = SUBSECTION_ORDER_INDEX[b.sutraKey] ?? 99
            if (ia !== ib) return ia - ib
            return a.label.localeCompare(b.label)
          })
        return { kind: 'sutra' as const, sectionKey, ...copy, subsections }
      }
      return { kind: 'flat' as const, sectionKey, ...copy, books }
    }).filter((s) =>
      s.kind === 'sutra' ? s.subsections.some((sub) => sub.books.length > 0) : s.books.length > 0,
    )
  }, [filteredSongbooks])

  const jumpNavItems = useMemo(
    () =>
      sections.map((s) => ({
        id: `songbooks-section-${s.sectionKey}`,
        label: s.title,
        mobileLabel: SECTION_MOBILE_LABELS[s.sectionKey],
      })),
    [sections],
  )

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main id="main-content" className="songbooks-page catalog-layout-shell">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="catalog-breadcrumbs__link">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Songbooks
            </span>
          </nav>

          <header className="catalog-page-intro" id="songbooks-page-top">
            <h1 className="catalog-page-h1">Songbooks</h1>
            <p className="catalog-page-sub">
              Curated playlists that tell a story. Some follow a sutra, some follow a mood, some follow a language. Each
              one groups the songs, the context, and the music in one place. Hit play.
            </p>
          </header>

          <section className="songbooks-page__filters" aria-label="Filter songbooks">
            <div className="songbooks-page__filters-head">
              <p className="songbooks-page__filters-status">
                {hasActiveFilters
                  ? `Showing ${filteredSongbooks.length} of ${songbooks.length} songbooks`
                  : `Browse ${songbooks.length} songbooks by type, sutra, topic, or keyword.`}
                {findQuery ? (
                  <>
                    {' '}
                    Search: <strong>&ldquo;{findQuery}&rdquo;</strong>.
                  </>
                ) : null}
              </p>
              {hasActiveFilters ? (
                <Link className="songbooks-page__filters-clear" to={songbooksBrowseHref()}>
                  Clear all filters
                </Link>
              ) : null}
            </div>

            <div className="songbooks-page__facet-row" aria-label="Filter by type">
              <span className="songbooks-page__facet-label">Type</span>
              <div className="songbooks-page__facet-chips">
                {typeFacetOptions.map((option) => (
                  <Link
                    key={option.key}
                    className={`songbooks-page__facet-chip${typeFilter === option.key ? ' songbooks-page__facet-chip--active' : ''}`}
                    to={buildFilterHref({ type: typeFilter === option.key ? null : option.key })}
                  >
                    {option.label} <span aria-hidden>({option.count})</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="songbooks-page__facet-row" aria-label="Filter by sutra">
              <span className="songbooks-page__facet-label">Sutra</span>
              <div className="songbooks-page__facet-chips">
                {sutraFacetOptions.map((option) => (
                  <Link
                    key={option.value}
                    className={`songbooks-page__facet-chip${sutraFilter === option.value ? ' songbooks-page__facet-chip--active' : ''}`}
                    to={buildFilterHref({ sutra: sutraFilter === option.value ? null : option.value })}
                  >
                    {option.value} <span aria-hidden>({option.count})</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="songbooks-page__facet-row" aria-label="Filter by topic">
              <span className="songbooks-page__facet-label">Topic</span>
              <div className="songbooks-page__facet-chips">
                {visibleTopicFacetOptions.map((option) => (
                  <Link
                    key={option.value}
                    className={`songbooks-page__facet-chip${topicFilter === option.value ? ' songbooks-page__facet-chip--active' : ''}`}
                    to={buildFilterHref({ topic: topicFilter === option.value ? null : option.value })}
                  >
                    {option.value} <span aria-hidden>({option.count})</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {featuredSongbook && !hasActiveFilters ? (
            <section className="songbooks-page__featured-rotator" aria-labelledby="songbooks-featured-songbook-heading">
              <h2 id="songbooks-featured-songbook-heading" className="catalog-section-title">
                Featured songbook
              </h2>
              <div className="songbooks-page__featured-rotator-grid">
                <LazySoundCloudEmbed scUrl={featuredSongbook.playlist_url} title={featuredSongbook.songbook} />
                <div className="songbooks-page__featured-rotator-copy">
                  <p className="songbooks-page__featured-rotator-kicker">{songbookFeaturedKickerLabel(featuredSongbook)}</p>
                  <h3 className="songbooks-page__featured-rotator-title">{featuredSongbook.songbook}</h3>
                  {featuredSongbook.description ? (
                    <p className="songbooks-page__featured-rotator-desc">{featuredSongbook.description}</p>
                  ) : null}
                  <SongbookPlaylistMetaLine book={featuredSongbook} />
                  <Link className="songbooks-page__featured-rotator-cta" to={songbookHrefFromCatalogItem(featuredSongbook)}>
                    Open songbook →
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {sections.length > 1 ? (
            <div className="catalog-page-shell__jump-region">
              <CatalogPageJumpNav items={jumpNavItems} />
            </div>
          ) : null}

          <div className="songbooks-page__sections" aria-label="Songbook sections by type">
            {sections.length === 0 ? (
              <section className="songbooks-page__empty">
                <h2 className="songbooks-page__section-title catalog-section-title">No songbooks match these filters</h2>
                <p className="songbooks-page__section-intro">
                  Try a broader keyword or clear one facet to widen the playlist set.
                </p>
                <Link className="catalog-section-cta" to={songbooksPath}>
                  Reset filters →
                </Link>
              </section>
            ) : null}
            {sections.map((section) =>
              section.kind === 'sutra' ? (
                <section key={section.sectionKey} className="songbooks-page__section" aria-labelledby={`songbooks-section-${section.sectionKey}`}>
                  <header className="songbooks-page__section-header">
                    <h2 id={`songbooks-section-${section.sectionKey}`} className="songbooks-page__section-title catalog-section-title">
                      {section.title}
                    </h2>
                    <p className="songbooks-page__section-intro">{section.intro}</p>
                  </header>
                  {section.subsections.map((sub) => {
                    if (sub.books.length === 0) return null
                    const laneIntro = sutraIntroForKey(sub.sutraKey)
                    return (
                      <div
                        key={sub.sutraKey}
                        className={`songbooks-page__subsection${sub.sutraKey === 'QUACK' ? ' songbooks-page__subsection--quack' : ''}`}
                        aria-labelledby={`songbooks-sub-${section.sectionKey}-${sub.sutraKey}`}
                      >
                        <h3 id={`songbooks-sub-${section.sectionKey}-${sub.sutraKey}`} className="songbooks-page__subsection-title">
                          {sub.label}
                        </h3>
                        {laneIntro ? <p className="songbooks-page__subsection-intro">{laneIntro}</p> : null}
                        <div
                          className={gridClassForSection(section.sectionKey)}
                          aria-label={`${sub.label} songbooks`}
                        >
                          {sub.books.map((book) => (
                            <SongbookCard key={book.slug} book={book} />
                          ))}
                        </div>
                        <Link className="catalog-section-cta" to={sutraHrefForFamily(sub.sutraKey as SutraFamilyKey)}>
                          Explore {sub.sutraKey}sutra →
                        </Link>
                      </div>
                    )
                  })}
                  <Link className="catalog-section-cta" to={ABOUT_SUTRAS_HREF}>
                    More on the sutras →
                  </Link>
                  <p className="songbooks-page__section-back">
                    <a href="#songbooks-page-top" className="songbooks-page__section-back-link">
                      ↑ Back to top
                    </a>
                  </p>
                </section>
              ) : (
                <section key={section.sectionKey} className="songbooks-page__section" aria-labelledby={`songbooks-section-${section.sectionKey}`}>
                  <header className="songbooks-page__section-header">
                    <h2 id={`songbooks-section-${section.sectionKey}`} className="songbooks-page__section-title catalog-section-title">
                      {section.title}
                    </h2>
                    <p className="songbooks-page__section-intro">{section.intro}</p>
                  </header>
                  <div className={gridClassForSection(section.sectionKey)} aria-label={`${section.title} songbooks`}>
                    {section.books.map((book) => (
                      <SongbookCard key={book.slug} book={book} />
                    ))}
                  </div>
                  <p className="songbooks-page__section-back">
                    <a href="#songbooks-page-top" className="songbooks-page__section-back-link">
                      ↑ Back to top
                    </a>
                  </p>
                </section>
              ),
            )}
          </div>
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
