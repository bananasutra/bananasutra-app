import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { FeaturedSongbookSpotlight } from './FeaturedSongbookSpotlight'
import { allSongbooks, songbookHref } from './songbooks'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalogBrowse } from './generatedData'
import { filterSongsByAlbumSearchQuery, searchTokens } from './searchMatch'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import './CatalogApp.css'
import './FeaturedSongbookSpotlight.css'
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

const SONGBOOK_CARD_ART_REQUEST_WIDTH = 480
const SONGBOOK_CARD_ART_SIZES = '(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 260px'
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filters = useMemo(() => readSongbooksFiltersFromParams(searchParams), [searchParams])
  const [findDraft, setFindDraft] = useState(filters.find)
  const filtersRef = useRef(filters)
  const [filtersOpen, setFiltersOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 900))
  const [visitSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const sync = () => {
      if (mq.matches) setFiltersOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const pageMeta = renderPageMeta({
    title: 'Songbooks & Playlists',
    description: 'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
    path: canonicalPathForRoute('/songbooks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [searchParams.toString(), filtersOpen])

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

  const songbookActiveFilterContext = (
    <section
      className="catalog-active-context"
      aria-label={hasActiveFilters ? 'Active songbook filters and result count' : 'Songbook result count'}
    >
      <p className="catalog-active-context__summary">{songbookContextSummary}</p>
      {hasActiveFilters ? (
        <div className="catalog-chips">
          {filters.find ? (
            <Link to={hrefSongbooks({ find: '' }, filters)} className="catalog-chip catalog-chip--find">
              Discovery: {filters.find}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.type ? (
            <Link to={hrefSongbooks({ type: '' }, filters)} className="catalog-chip">
              Type: {SECTION_COPY[filters.type].title}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.sutra ? (
            <Link to={hrefSongbooks({ sutra: '' }, filters)} className="catalog-chip">
              Sutra: {filters.sutra}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.topic ? (
            <Link to={hrefSongbooks({ topic: '' }, filters)} className="catalog-chip">
              Topic: {filters.topic}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          <Link to={clearAllSongbookFiltersHref} className="catalog-clear">
            Clear all
          </Link>
        </div>
      ) : null}
    </section>
  )

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

        <div className={`catalog-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
          <aside className={`catalog-filters${filtersOpen ? ' is-open' : ''}`} aria-labelledby="songbooks-filters-heading">
            <div className="catalog-filters-head">
              <h2 id="songbooks-filters-heading" className="catalog-section-title">
                Filters
              </h2>
              <button
                type="button"
                className="catalog-icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-expanded={filtersOpen}
                aria-controls="songbooks-filter-panel"
              >
                Hide
              </button>
            </div>
            {filtersOpen ? songbookActiveFilterContext : null}
            <div id="songbooks-filter-panel" className="catalog-facet-stack">
              <section className="catalog-facet" aria-labelledby="songbooks-search-heading">
                <h3 id="songbooks-search-heading">Search</h3>
                <label className="catalog-facet-find-label" htmlFor="songbooks-find-input">
                  Search by songbook title, member songs, or catalog summary
                </label>
                <input
                  id="songbooks-find-input"
                  className="catalog-facet-find-input"
                  type="search"
                  name="songbooks_find"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  value={findDraft}
                  onChange={(e) => setFindDraft(e.target.value)}
                />
              </section>
              <p className="catalog-facet-help">Filters combine across groups (AND). One active value per group.</p>
              <section className="catalog-facet" aria-labelledby="songbooks-type-heading">
                <h3 id="songbooks-type-heading">Type</h3>
                <div className="catalog-facet-chips" role="group" aria-labelledby="songbooks-type-heading">
                  <Link className={`catalog-facet-chip${!filters.type ? ' is-active' : ''}`} to={hrefSongbooks({ type: '' }, filters)}>
                    <span>All</span>
                    <span className="catalog-facet-count">{` (${contextualRowsWithoutType.length})`}</span>
                  </Link>
                  {typeFacetOptions.map((option) => {
                    const active = filters.type === option.key
                    const disabled = !active && option.count === 0
                    return (
                      <Link
                        key={option.key}
                        className={`catalog-facet-chip${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
                        to={hrefSongbooks({ type: active ? '' : option.key }, filters)}
                        aria-disabled={disabled}
                        tabIndex={disabled ? -1 : undefined}
                        onClick={(event) => {
                          if (disabled) event.preventDefault()
                        }}
                      >
                        <span>{option.label}</span>
                        <span className="catalog-facet-count">{` (${option.count})`}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
              <section className="catalog-facet" aria-labelledby="songbooks-sutra-heading">
                <h3 id="songbooks-sutra-heading">Sutra (primary)</h3>
                <div className="catalog-facet-chips" role="group" aria-labelledby="songbooks-sutra-heading">
                  <Link className={`catalog-facet-chip${!filters.sutra ? ' is-active' : ''}`} to={hrefSongbooks({ sutra: '' }, filters)}>
                    <span>All</span>
                    <span className="catalog-facet-count">{` (${contextualRowsWithoutSutra.length})`}</span>
                  </Link>
                  {sutraFacetOptions.map((option) => {
                    const active = filters.sutra === option.value
                    const disabled = !active && option.count === 0
                    return (
                      <Link
                        key={option.value}
                        className={`catalog-facet-chip${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
                        to={hrefSongbooks({ sutra: active ? '' : option.value }, filters)}
                        aria-disabled={disabled}
                        tabIndex={disabled ? -1 : undefined}
                        onClick={(event) => {
                          if (disabled) event.preventDefault()
                        }}
                      >
                        <span>{option.value}</span>
                        <span className="catalog-facet-count">{` (${option.count})`}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
              <section className="catalog-facet" aria-labelledby="songbooks-topic-heading">
                <h3 id="songbooks-topic-heading">Topic</h3>
                <div className="catalog-facet-chips" role="group" aria-labelledby="songbooks-topic-heading">
                  <Link className={`catalog-facet-chip${!filters.topic ? ' is-active' : ''}`} to={hrefSongbooks({ topic: '' }, filters)}>
                    <span>All</span>
                    <span className="catalog-facet-count">{` (${contextualRowsWithoutTopic.length})`}</span>
                  </Link>
                  {topicFacetOptions.map((option) => {
                    const active = filters.topic === option.value
                    const disabled = !active && option.count === 0
                    return (
                      <Link
                        key={option.value}
                        className={`catalog-facet-chip${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
                        to={hrefSongbooks({ topic: active ? '' : option.value }, filters)}
                        aria-disabled={disabled}
                        tabIndex={disabled ? -1 : undefined}
                        onClick={(event) => {
                          if (disabled) event.preventDefault()
                        }}
                      >
                        <span>{option.value}</span>
                        <span className="catalog-facet-count">{` (${option.count})`}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            </div>
          </aside>

          <main id="main-content" className="catalog-main songbooks-page__main">
            {!filtersOpen ? (
              <>
                {songbookActiveFilterContext}
                <button
                  type="button"
                  className="catalog-filter-reopen"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={false}
                  aria-controls="songbooks-filter-panel"
                >
                  Show filters
                </button>
              </>
            ) : null}

            {featuredSongbook ? (
              <section className="songbooks-page__featured-rotator" aria-labelledby="songbooks-featured-songbook-heading">
                <h2 id="songbooks-featured-songbook-heading" className="catalog-section-title">
                  Featured songbook
                </h2>
                <FeaturedSongbookSpotlight
                  book={featuredSongbook}
                  className="songbooks-page__featured-spotlight"
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
                          <div className={gridClassForSection(section.sectionKey)} aria-label={`${sub.label} songbooks`}>
                            {sub.books.map((book) => (
                              <SongbookCard key={book.slug} book={book} />
                            ))}
                          </div>
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
                    <div className={gridClassForSection(section.sectionKey)} aria-label={`${section.title} songbooks`}>
                      {section.books.map((book) => (
                        <SongbookCard key={book.slug} book={book} />
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>
          </main>
        </div>
      </div>
      <GlobalFooter />
    </div>
  )
}
