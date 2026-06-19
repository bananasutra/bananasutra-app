import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'
import { linkFacetChip } from './catalogFilterBarBuilders'
import { sutraClassName, sutraFilterChipClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { FeaturedSongbookSpotlight } from './FeaturedSongbookSpotlight'
import { allSongbooks, songbookHref } from './songbooks'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { ListenLpSongbookThumb } from './ListenLpSongbookThumb'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalogBrowse } from './generatedData'
import { filterSongsByAlbumSearchQuery, searchTokens } from './searchMatch'
import './CatalogApp.css'
import './FeaturedSongbookSpotlight.css'
import './ListenLpPage.css'
import './SongbooksPage.css'

function byPopularityScore(songbook: {
  playlist_total_plays: number
  playlist_total_likes: number
  songs_with_in_app_playback: number
}): number {
  return songbook.playlist_total_plays + 40 * songbook.playlist_total_likes + songbook.songs_with_in_app_playback
}

type SongbookSectionKey = 'sutra' | 'collection' | 'genre' | 'language' | 'other'
type SongbookPrimarySutraTag =
  | 'KNOWSUTRA'
  | 'BLOWSUTRA'
  | 'SHOWSUTRA'
  | 'GROWSUTRA'
  | 'FLOWSUTRA'
  | 'GLOWSUTRA'
  | 'BOWSUTRA'
  | 'QUACKSUTRA'

/** Primary sections top-to-bottom; Collections last per IA. */
const SECTION_ORDER: SongbookSectionKey[] = ['sutra', 'genre', 'language', 'collection', 'other']

const SUTRA_CORE_ORDER = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW'] as const
const PRIMARY_SUTRA_TAG_ORDER: SongbookPrimarySutraTag[] = [
  'KNOWSUTRA',
  'BLOWSUTRA',
  'SHOWSUTRA',
  'GROWSUTRA',
  'FLOWSUTRA',
  'GLOWSUTRA',
  'BOWSUTRA',
  'QUACKSUTRA',
]

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

type SongbooksUrlFilters = {
  find: string
  type: SongbookSectionKey | ''
  sutra: SongbookPrimarySutraTag | ''
  topic: string
}

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

function readSongbooksFiltersFromParams(searchParams: URLSearchParams): SongbooksUrlFilters {
  const rawType = (searchParams.get('type') ?? '').trim().toLowerCase()
  const type: SongbookSectionKey | '' =
    rawType && SECTION_ORDER.includes(rawType as SongbookSectionKey) ? (rawType as SongbookSectionKey) : ''
  const sutra = (searchParams.get('sutra') ?? '').trim().toUpperCase() as SongbookPrimarySutraTag | ''
  return {
    find: (searchParams.get('find') ?? '').trim(),
    type,
    sutra,
    topic: (searchParams.get('topic') ?? '').trim().toUpperCase(),
  }
}

function songbooksFiltersToQueryString(filters: SongbooksUrlFilters): string {
  const p = new URLSearchParams()
  if (filters.find) p.set('find', filters.find)
  if (filters.type) p.set('type', filters.type)
  if (filters.sutra) p.set('sutra', filters.sutra)
  if (filters.topic) p.set('topic', filters.topic)
  const q = p.toString()
  return q ? `?${q}` : ''
}

function hrefSongbooks(partial: Partial<SongbooksUrlFilters>, base: SongbooksUrlFilters): string {
  const merged: SongbooksUrlFilters = { ...base, ...partial }
  return browsePathWithQuery('/songbooks', songbooksFiltersToQueryString(merged).replace(/^\?/, ''))
}

function hashString(input: string): number {
  let hash = 0
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

function primarySutraTagForBook(book: ListedSongbook): SongbookPrimarySutraTag | '' {
  const rollup = (book.sutra_id_rollup || '').trim().toUpperCase()
  if (!rollup) return ''
  const tail = (rollup.split('-').pop() || '').trim()
  if (tail === 'QUACK') return 'QUACKSUTRA'
  if (SUTRA_CORE_ORDER.includes(tail as (typeof SUTRA_CORE_ORDER)[number])) return `${tail}SUTRA` as SongbookPrimarySutraTag
  return ''
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

function SongbookThumbGrid({ books, label }: { books: ListedSongbook[]; label: string }) {
  return (
    <ul className="listen-lp__songbook-grid" aria-label={label}>
      {books.map((book) => (
        <li key={book.slug} className="listen-lp__songbook-grid-cell">
          <ListenLpSongbookThumb book={book} />
        </li>
      ))}
    </ul>
  )
}

export function SongbooksPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filters = useMemo(() => readSongbooksFiltersFromParams(searchParams), [searchParams])
  const [findDraft, setFindDraft] = useState(filters.find)
  const filtersRef = useRef(filters)
  const [visitSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)
  const { data: songCatalogRows } = useSongCatalogBrowse()

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL can be edited externally
    setFindDraft(filters.find)
  }, [filters.find])

  useEffect(() => {
    if (findDraft === filters.find) return
    const tid = window.setTimeout(() => {
      navigate(hrefSongbooks({ find: findDraft.trim() }, filtersRef.current), { replace: true })
    }, 350)
    return () => window.clearTimeout(tid)
  }, [findDraft, filters.find, navigate])

  const pageMeta = renderPageMeta({
    title: 'Songbooks & Playlists',
    description: 'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
    path: canonicalPathForRoute('/songbooks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [searchParams.toString(), filterBarExpanded])

  const songCatalog = useMemo(() => songCatalogRows ?? [], [songCatalogRows])
  const songbooks = useMemo(() => [...allSongbooks()].sort(sortBooks), [])
  const findTokens = useMemo(() => searchTokens(filters.find), [filters.find])
  const songbookMatchesFromDiscoveryFind = useMemo(() => {
    if (!findTokens.length || songCatalog.length === 0) return new Set<string>()
    const songs = filterSongsByAlbumSearchQuery(songCatalog, filters.find)
    return new Set(songs.map((song) => (song.songbook || '').trim()).filter(Boolean))
  }, [findTokens, songCatalog, filters.find])

  const applySongbookFilters = (books: ListedSongbook[], nextFilters: SongbooksUrlFilters): ListedSongbook[] =>
    books.filter((book) => {
      if (nextFilters.type && sectionKeyForType(book.songbook_type) !== nextFilters.type) return false
      if (nextFilters.sutra && primarySutraTagForBook(book) !== nextFilters.sutra) return false
      if (nextFilters.topic) {
        const topics = new Set(splitFacetValuesUpper(book.topics_primary))
        if (!topics.has(nextFilters.topic)) return false
      }
      if (!findTokens.length) return true
      if (songbookMatchesFromDiscoveryFind.has(book.songbook.trim())) return true
      return songbookMatchesFindFallback(book, findTokens)
    })

  const filteredSongbooks = useMemo(
    () => applySongbookFilters(songbooks, filters),
    [songbooks, filters, findTokens, songbookMatchesFromDiscoveryFind],
  )
  const contextualRowsWithoutType = useMemo(
    () => applySongbookFilters(songbooks, { ...filters, type: '' }),
    [songbooks, filters, findTokens, songbookMatchesFromDiscoveryFind],
  )
  const contextualRowsWithoutSutra = useMemo(
    () => applySongbookFilters(songbooks, { ...filters, sutra: '' }),
    [songbooks, filters, findTokens, songbookMatchesFromDiscoveryFind],
  )
  const contextualRowsWithoutTopic = useMemo(
    () => applySongbookFilters(songbooks, { ...filters, topic: '' }),
    [songbooks, filters, findTokens, songbookMatchesFromDiscoveryFind],
  )

  const typeFacetOptions = useMemo(
    () =>
      SECTION_ORDER.map((key) => ({
        key,
        label: SECTION_COPY[key].title,
        count: contextualRowsWithoutType.filter((book) => sectionKeyForType(book.songbook_type) === key).length,
      })).filter((entry) => entry.count > 0),
    [contextualRowsWithoutType],
  )
  const sutraFacetOptions = useMemo(
    () =>
      PRIMARY_SUTRA_TAG_ORDER.map((tag) => ({
        value: tag,
        count: contextualRowsWithoutSutra.filter((book) => primarySutraTagForBook(book) === tag).length,
      })).filter((entry) => entry.count > 0),
    [contextualRowsWithoutSutra],
  )
  const topicFacetOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of contextualRowsWithoutTopic) {
      for (const topic of new Set(splitFacetValuesUpper(book.topics_primary))) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1)
      }
    }
    const sorted = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    const base = sorted.slice(0, 24)
    if (!filters.topic || base.some((entry) => entry.value === filters.topic)) return base
    const active = sorted.find((entry) => entry.value === filters.topic)
    return active ? [...base, active] : base
  }, [contextualRowsWithoutTopic, filters.topic])

  const hasActiveFilters = Boolean(filters.find || filters.type || filters.sutra || filters.topic)
  const clearAllSongbookFiltersHref = hrefSongbooks({ find: '', type: '', sutra: '', topic: '' }, filters)
  const featuredSongbook = useMemo(() => {
    const pool = filteredSongbooks.filter((book) => Boolean(book.playlist_url))
    if (pool.length === 0) return null
    const filterSeed = songbooksFiltersToQueryString(filters) || '__all__'
    return pool[hashString(`${visitSeed}|${filterSeed}`) % pool.length] ?? null
  }, [filteredSongbooks, filters, visitSeed])

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
          .map(([sutraKey, list]) => ({ sutraKey, label: sutraSubsectionLabel(sutraKey), books: list.sort(sortBooks) }))
          .sort((a, b) => {
            const ia = SUBSECTION_ORDER_INDEX[a.sutraKey] ?? 99
            const ib = SUBSECTION_ORDER_INDEX[b.sutraKey] ?? 99
            if (ia !== ib) return ia - ib
            return a.label.localeCompare(b.label)
          })
        return { kind: 'sutra' as const, sectionKey, ...copy, subsections }
      }
      return { kind: 'flat' as const, sectionKey, ...copy, books }
    }).filter((s) => (s.kind === 'sutra' ? s.subsections.some((sub) => sub.books.length > 0) : s.books.length > 0))
  }, [filteredSongbooks])

  const songbookContextSummary = hasActiveFilters
    ? `${filteredSongbooks.length} of ${songbooks.length} songbooks`
    : `${songbooks.length} songbooks`

  const songbookActivePills: CatalogFilterBarActivePill[] = []
  if (filters.find) {
    songbookActivePills.push({
      id: 'find',
      label: <>Search: {filters.find}</>,
      href: hrefSongbooks({ find: '' }, filters),
      title: 'Remove text filter',
    })
  }
  if (filters.type) {
    songbookActivePills.push({
      id: 'type',
      label: <>Type: {SECTION_COPY[filters.type].title}</>,
      href: hrefSongbooks({ type: '' }, filters),
      title: 'Remove type filter',
    })
  }
  if (filters.sutra) {
    songbookActivePills.push({
      id: 'sutra',
      label: (
        <>
          Sutra:{' '}
          <span className={`catalog-facet-sutra-name ${sutraClassName(filters.sutra)}`}>{filters.sutra}</span>
        </>
      ),
      href: hrefSongbooks({ sutra: '' }, filters),
      title: `Remove sutra filter · ${sutraQuestionFromDisplay(filters.sutra)}`,
    })
  }
  if (filters.topic) {
    songbookActivePills.push({
      id: 'topic',
      label: <>Topic: {filters.topic}</>,
      href: hrefSongbooks({ topic: '' }, filters),
      title: 'Remove topic filter',
    })
  }

  const songbookFacetGroups: CatalogFilterBarFacetGroup[] = [
    {
      id: 'type',
      label: 'Type',
      allHref: hrefSongbooks({ type: '' }, filters),
      allCount: contextualRowsWithoutType.length,
      allTitle: `${contextualRowsWithoutType.length} songbooks`,
      options: typeFacetOptions.map((option) => {
        const active = filters.type === option.key
        const disabled = !active && option.count === 0
        return linkFacetChip({
          id: `type-${option.key}`,
          label: option.label,
          href: hrefSongbooks({ type: active ? '' : option.key }, filters),
          count: option.count,
          active,
          disabled,
          title: `${option.count} songbooks`,
        })
      }),
    },
    {
      id: 'sutra',
      label: 'Sutra',
      allHref: hrefSongbooks({ sutra: '' }, filters),
      allCount: contextualRowsWithoutSutra.length,
      allTitle: `${contextualRowsWithoutSutra.length} songbooks`,
      options: sutraFacetOptions.map((option) => {
        const active = filters.sutra === option.value
        const disabled = !active && option.count === 0
        return linkFacetChip({
          id: `sutra-${option.value}`,
          label: (
            <span className={`catalog-facet-sutra-name ${sutraClassName(option.value)}`}>{option.value}</span>
          ),
          href: hrefSongbooks({ sutra: active ? '' : option.value }, filters),
          count: option.count,
          active,
          disabled,
          className: sutraFilterChipClassName(option.value),
          title: `${sutraQuestionFromDisplay(option.value)} (${option.count} songbooks)`,
        })
      }),
    },
    {
      id: 'topic',
      label: 'Topic',
      allHref: hrefSongbooks({ topic: '' }, filters),
      allCount: contextualRowsWithoutTopic.length,
      allTitle: `${contextualRowsWithoutTopic.length} songbooks`,
      options: topicFacetOptions.map((option) => {
        const active = filters.topic === option.value
        const disabled = !active && option.count === 0
        return linkFacetChip({
          id: `topic-${option.value}`,
          label: option.value,
          href: hrefSongbooks({ topic: active ? '' : option.value }, filters),
          count: option.count,
          active,
          disabled,
          title: `${option.count} songbooks`,
        })
      }),
    },
  ]

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
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
        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">Songbooks</h1>
          <p className="catalog-page-sub">
            Curated playlists that tell a story. Some follow a sutra, some follow a mood, some follow a language. Need
            orientation first? <Link to={ABOUT_SUTRAS_HREF}>Start with the sutra compass.</Link>
          </p>
        </div>

        <main id="main-content" className="songbooks-page songbooks-page__stacked">
          <CatalogFilterBar
            ariaLabel="Filter songbooks"
            panelId="songbooks-filter-panel"
            resultSummary={songbookContextSummary}
            activePills={songbookActivePills}
            clearAllHref={clearAllSongbookFiltersHref}
            facetGroups={songbookFacetGroups}
            search={{
              id: 'songbooks-find-input',
              label: 'Search',
              ariaLabel: 'Search songbooks by title, member songs, or catalog summary',
              value: findDraft,
              onChange: setFindDraft,
              inputName: 'songbooks_find',
            }}
            combineHelpText="Filters combine across groups (AND). One active value per group."
            defaultExpanded={filterBarExpanded}
            onExpandedChange={setFilterBarExpanded}
          />

          {featuredSongbook ? (
              <section className="songbooks-page__featured-rotator" aria-labelledby="songbooks-featured-songbook-heading">
                <h2 id="songbooks-featured-songbook-heading" className="catalog-section-title">
                  Featured songbook
                </h2>
                <FeaturedSongbookSpotlight
                  book={featuredSongbook}
                  className="songbooks-page__featured-spotlight"
                  layout="stacked"
                  ctaTo={songbookHref(featuredSongbook.songbook)}
                  embed={
                    <LazySoundCloudEmbed scUrl={featuredSongbook.playlist_url} title={featuredSongbook.songbook} />
                  }
                />
              </section>
            ) : null}

            <div className="songbooks-page__sections" aria-label="Songbook sections by type">
              {sections.length === 0 ? (
                <section className="songbooks-page__empty">
                  <h2 className="songbooks-page__section-title catalog-section-title">No songbooks match these filters</h2>
                  <p className="songbooks-page__section-intro">Try a broader keyword or clear one facet to widen the playlist set.</p>
                  <Link className="catalog-section-cta" to={clearAllSongbookFiltersHref}>
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
                          <SongbookThumbGrid books={sub.books} label={`${sub.label} songbooks`} />
                        </div>
                      )
                    })}
                  </section>
                ) : (
                  <section key={section.sectionKey} className="songbooks-page__section" aria-labelledby={`songbooks-section-${section.sectionKey}`}>
                    <header className="songbooks-page__section-header">
                      <h2 id={`songbooks-section-${section.sectionKey}`} className="songbooks-page__section-title catalog-section-title">
                        {section.title}
                      </h2>
                      <p className="songbooks-page__section-intro">{section.intro}</p>
                    </header>
                    <SongbookThumbGrid books={section.books} label={`${section.title} songbooks`} />
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
