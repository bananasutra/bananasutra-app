import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { sutraClassName } from './sutraTheme'
import { SUTRA_CONTEXT, type SutraFamilyKey } from './sutraContext'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { FeaturedSongbookSpotlight } from './FeaturedSongbookSpotlight'
import { allSongbooks, songbookHref } from './songbooks'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { ListenLpSongbookThumb } from './ListenLpSongbookThumb'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { ScrollRevealSection } from './ScrollRevealSection'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import './CatalogApp.css'
import './FeaturedSongbookSpotlight.css'
import './ListenLpPage.css'
import './WordsPage.css'
import './SongbooksPage.css'

function byPopularityScore(songbook: {
  playlist_total_plays: number
  playlist_total_likes: number
  songs_with_in_app_playback: number
}): number {
  return songbook.playlist_total_plays + 40 * songbook.playlist_total_likes + songbook.songs_with_in_app_playback
}

type SongbookSectionKey = 'sutra' | 'collection' | 'genre' | 'language' | 'other'

const SECTION_ORDER: SongbookSectionKey[] = ['sutra', 'genre', 'language', 'collection', 'other']

const SUTRA_CORE_ORDER = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW'] as const

/** KNOW → BOW, with QUACK nested under BLOW in the render path (not its own top-level lane). */
const SUTRA_LANE_ORDER = [...SUTRA_CORE_ORDER] as const

type ListedSongbook = ReturnType<typeof allSongbooks>[number]

const SECTION_COPY: Record<Exclude<SongbookSectionKey, 'sutra'>, { title: string; intro?: string }> = {
  collection: { title: 'Collections' },
  genre: { title: 'Genres' },
  language: { title: 'Languages' },
  other: { title: 'Songbooks' },
}

const JUMP_NAV_ITEMS = [
  { id: 'sec-sutras', label: 'Sutras' },
  { id: 'sec-genre', label: 'Genres' },
  { id: 'sec-language', label: 'Languages' },
  { id: 'sec-collections', label: 'Collections' },
] as const

/** Editorial lane intros (R90). Order of songbooks within a lane uses SONGBOOK_LANE_ORDER. */
const SUTRA_LANE_INTROS: Record<string, string> = {
  KNOW:
    "Two things matter here: truth and peace. Ask Bertrand, because the question matters more than the comfort of the answer, and keep asking But(t) Why until the polite story falls apart. Truth, in this sutra, is the naked kind: it doesn't care if you're embarrassed. Peace is truth applied to history, a pattern of deceit we keep choosing not to see, until we do.",
  BLOW:
    "BLOW opens with a diagnosis: apes gone wrong, ego gone loco. Follow it far enough and you find the consequence: an ego that size doesn't just harm, it censors the truths it can't survive. So BLOW ends in one instruction: revolt, now. Loud, necessary, and yes, it stinks.",
  QUACK:
    "QUACK is BLOW's unruly sub-sutra: a shady duck running a FOTUS circus of MAGA nonsense, mocked with surgical precision, because normalizing insanity is the real enemy.",
  SHOW:
    'SHOW is the emergency joy valve: banana jokes, holy fools, and a party dressed as your most hilarious self, because angels fly by taking themselves lightly.',
  GROW:
    "GROW echoes KNOW, just braver: clarity turned into the courage to care out loud. Dare(to care) leans on Bertrand Russell's warning that most opinions are built for comfort, not truth, and answers today's empathy deficit with one antidote: kindness, the bridge into FLOW and GLOW.",
  FLOW:
    'FLOW is trust in two directions: trusting yourself enough to be water, and trusting someone else enough to be truly intimate with them.',
  GLOW:
    "GLOW is gratitude with grit, and poetry is how it's felt, not just described. It's hard to feel eternal gratitude without the magic of poetry to hold it.",
  BOW: 'BOW is the full circle, the fool circle really, where grace meets gravity and the cycle starts over, back in the KNOW.',
}

/** Editorial order within each lane. KNOW uses current catalog popularity order. */
const SONGBOOK_LANE_ORDER: Record<string, string[]> = {
  BLOW: ['Speak: APES (gone wrong)', 'Speak: EGO (gone loco)', 'Speak: CENSOR(ed)', 'Speak: REVOLT (now)'],
  QUACK: ['Quack: DUCK (shady)', 'Quack: FOTUS Circus', 'Quack: MAxxxA Saga'],
  SHOW: ['Play: B.J. (is for banana jokes)', 'Play: FANANA (party)', 'Play: (Be) The Fool'],
  GROW: ['Dare: DARE (to care)', 'Dare: GOD (etc.)', 'Dare: KIND(ness)'],
  FLOW: ['Trust: FLY (like water)', 'Trust: WET (my friend)'],
  GLOW: ['Bless: RAINBOWS (in my clouds)', 'Bless: POET(ry)'],
  BOW: ['Bow: Death (is nothing)', 'Bow: (Thank) Dogs', 'Bow: Cosmic Bananas'],
}

function sectionKeyForType(raw: string | undefined): SongbookSectionKey {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'sutra' || t === 'collection' || t === 'genre' || t === 'language') return t
  return 'other'
}

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

function sortBooksPopularity(a: ListedSongbook, b: ListedSongbook): number {
  return byPopularityScore(b) - byPopularityScore(a) || a.songbook.localeCompare(b.songbook)
}

function sortBooksInLane(laneKey: string, books: ListedSongbook[]): ListedSongbook[] {
  const order = SONGBOOK_LANE_ORDER[laneKey]
  if (!order?.length) return [...books].sort(sortBooksPopularity)
  const index = new Map(order.map((name, i) => [name, i]))
  return [...books].sort((a, b) => {
    const ia = index.has(a.songbook) ? index.get(a.songbook)! : 999
    const ib = index.has(b.songbook) ? index.get(b.songbook)! : 999
    if (ia !== ib) return ia - ib
    return sortBooksPopularity(a, b)
  })
}

function hashString(input: string): number {
  let hash = 0
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

function featuredSongbookSutraLabel(sutras: string): string {
  return (sutras || '').split(',')[0]?.trim() ?? ''
}

function laneQuestion(key: string): string {
  if (key === 'OTHER') return ''
  const family = key as SutraFamilyKey
  return SUTRA_CONTEXT[family]?.question ?? ''
}

function SongbookThumbGrid({
  books,
  label,
  columns = 'default',
}: {
  books: ListedSongbook[]
  label: string
  columns?: 'default' | 'triple'
}) {
  return (
    <ul
      className={`listen-lp__songbook-grid${columns === 'triple' ? ' songbooks-page__songbook-grid--triple' : ''}`}
      aria-label={label}
    >
      {books.map((book) => (
        <li key={book.slug} className="listen-lp__songbook-grid-cell">
          <ListenLpSongbookThumb book={book} />
        </li>
      ))}
    </ul>
  )
}

function SongbookRationaleRow({ book }: { book: ListedSongbook }) {
  const art = (book.playlist_artwork_url || '').trim()
  const cover = coverImageUrl(art, { width: 280 })
  const rationale = (book.songbook_rationale || '').trim()
  return (
    <li>
      <Link className="words-card-link songbooks-page__rationale-link" to={songbookHref(book.songbook)}>
        <article className="words-card songbooks-page__rationale-row">
          <div className="words-card__thumb" aria-hidden>
            {cover ? (
              <img
                src={cover}
                srcSet={buildSrcset(art, [180, 280, 360])}
                sizes="128px"
                alt=""
                width={280}
                height={280}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="songbooks-page__rationale-thumb-fallback">♪</span>
            )}
          </div>
          <div className="words-card__text">
            <h3 className="words-card__title songbooks-page__rationale-title">{book.songbook}</h3>
            <SongbookPlaylistMetaLine book={book} />
            {rationale ? <p className="words-card__summary">{rationale}</p> : null}
          </div>
        </article>
      </Link>
    </li>
  )
}

function SongbookRationaleList({ books, label }: { books: ListedSongbook[]; label: string }) {
  return (
    <ul className="songbooks-page__rationale-list" aria-label={label}>
      {books.map((book) => (
        <SongbookRationaleRow key={book.slug} book={book} />
      ))}
    </ul>
  )
}

export function SongbooksPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [visitSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))

  const pageMeta = renderPageMeta({
    title: 'Songbooks & Playlists',
    description: 'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
    path: canonicalPathForRoute('/songbooks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  const songbooks = useMemo(() => [...allSongbooks()].sort(sortBooksPopularity), [])

  const featuredSongbook = useMemo(() => {
    const pool = songbooks.filter((book) => Boolean(book.playlist_url))
    if (pool.length === 0) return null
    return pool[hashString(`${visitSeed}|__all__`) % pool.length] ?? null
  }, [songbooks, visitSeed])
  const featuredSpotlightSutra = featuredSongbook ? featuredSongbookSutraLabel(featuredSongbook.sutras) : ''

  const bySection = useMemo(() => {
    const map = new Map<SongbookSectionKey, ListedSongbook[]>()
    for (const key of SECTION_ORDER) map.set(key, [])
    for (const book of songbooks) {
      const key = sectionKeyForType(book.songbook_type)
      map.get(key)!.push(book)
    }
    return map
  }, [songbooks])

  const sutraLanes = useMemo(() => {
    const sutraBooks = bySection.get('sutra') ?? []
    const bySub = new Map<string, ListedSongbook[]>()
    for (const book of sutraBooks) {
      const sk = primarySutraKeyForGrouping(book)
      if (!bySub.has(sk)) bySub.set(sk, [])
      bySub.get(sk)!.push(book)
    }
    return SUTRA_LANE_ORDER.map((key) => ({
      key,
      books: sortBooksInLane(key, bySub.get(key) ?? []),
      quackBooks: key === 'BLOW' ? sortBooksInLane('QUACK', bySub.get('QUACK') ?? []) : [],
    })).filter((lane) => lane.books.length > 0 || lane.quackBooks.length > 0)
  }, [bySection])

  const flatSections = useMemo(
    () =>
      (['genre', 'language', 'collection', 'other'] as const)
        .map((sectionKey) => {
          const books = [...(bySection.get(sectionKey) ?? [])].sort(sortBooksPopularity)
          return { sectionKey, ...SECTION_COPY[sectionKey], books }
        })
        .filter((s) => s.books.length > 0),
    [bySection],
  )

  const sectionAnchorId = (sectionKey: SongbookSectionKey): string => {
    if (sectionKey === 'genre') return 'sec-genre'
    if (sectionKey === 'language') return 'sec-language'
    if (sectionKey === 'collection') return 'sec-collections'
    return `songbooks-section-${sectionKey}`
  }

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
        <div className="catalog-page-intro catalog-page-intro--song-catalog songbooks-page__intro">
          <h1 className="catalog-page-h1">Songbooks</h1>
          <p className="catalog-page-sub">
            Every sutra is a question. Every songbook is what happened when I sat with that question long enough to
            write about it: not a playlist first, but a working topic, an angle a sutra kept circling back to until
            there were enough songs to give the pattern a name.
          </p>
          <p className="catalog-page-sub songbooks-page__intro-mobile-note">
            On mobile, songbooks are also the most reliable way to actually hear this: one playlist plays straight
            through, no need to keep tapping. Start with a sutra lane below, or skip to genre, language, and
            collection sets if you already know the sound you want. Prefer the compass first?{' '}
            <Link to={ABOUT_SUTRAS_HREF}>Start with the sutras.</Link>
          </p>
        </div>

        <main id="main-content" className="songbooks-page songbooks-page__stacked">
          {featuredSongbook ? (
            <ScrollRevealSection
              immediate
              className="songbooks-page__featured-rotator"
              aria-labelledby="songbooks-featured-songbook-heading"
            >
              <h2 id="songbooks-featured-songbook-heading" className="catalog-section-title">
                Featured songbook
                {featuredSpotlightSutra ? (
                  <>
                    {' : '}
                    <span className={`catalog-sutra-word ${sutraClassName(featuredSpotlightSutra)}`}>
                      {featuredSpotlightSutra}
                    </span>
                  </>
                ) : null}
              </h2>
              <FeaturedSongbookSpotlight
                book={featuredSongbook}
                className="songbooks-page__featured-spotlight"
                layout="stacked"
                stackedVariant="listen-lp"
                ctaTo={songbookHref(featuredSongbook.songbook)}
                embed={
                  <LazySoundCloudEmbed
                    scUrl={featuredSongbook.playlist_url}
                    title={featuredSongbook.songbook}
                    mode="list"
                    height={450}
                  />
                }
              />
            </ScrollRevealSection>
          ) : null}

          <CatalogPageJumpNav ariaLabel="Jump to a section" items={[...JUMP_NAV_ITEMS]} />

          <div className="songbooks-page__sections" aria-label="Songbook sections by type">
            <section id="sec-sutras" className="songbooks-page__section" aria-labelledby="songbooks-section-sutra">
              <header className="songbooks-page__section-header">
                <h2 id="songbooks-section-sutra" className="songbooks-page__section-title catalog-section-title">
                  Sutra songbooks
                </h2>
              </header>
              {sutraLanes.map((lane) => {
                const laneIntro = SUTRA_LANE_INTROS[lane.key]
                const question = laneQuestion(lane.key)
                return (
                  <div
                    key={lane.key}
                    className="songbooks-page__subsection"
                    aria-labelledby={`songbooks-sub-sutra-${lane.key}`}
                  >
                    <div className="songbooks-page__lane-hd">
                      <h3
                        id={`songbooks-sub-sutra-${lane.key}`}
                        className={`songbooks-page__lane-kicker catalog-sutra-word ${sutraClassName(`${lane.key}sutra`)}`}
                      >
                        {lane.key}
                      </h3>
                      {question ? <p className="songbooks-page__lane-q">{question}</p> : null}
                    </div>
                    {laneIntro ? <p className="songbooks-page__subsection-intro">{laneIntro}</p> : null}
                    {lane.books.length > 0 ? (
                      <SongbookRationaleList books={lane.books} label={`${lane.key}sutra songbooks`} />
                    ) : null}
                    {lane.key === 'BLOW' && lane.quackBooks.length > 0 ? (
                      <div
                        className="songbooks-page__subsection songbooks-page__subsection--quack"
                        aria-labelledby="songbooks-sub-sutra-QUACK"
                      >
                        <div className="songbooks-page__lane-hd">
                          <h4
                            id="songbooks-sub-sutra-QUACK"
                            className={`songbooks-page__lane-kicker songbooks-page__lane-kicker--quack catalog-sutra-word ${sutraClassName('QUACKsutra')}`}
                          >
                            QUACK
                          </h4>
                          <p className="songbooks-page__lane-q">
                            {laneQuestion('QUACK')}
                            <span className="songbooks-page__lane-q-note"> · sub-sutra of BLOW</span>
                          </p>
                        </div>
                        {SUTRA_LANE_INTROS.QUACK ? (
                          <p className="songbooks-page__subsection-intro">{SUTRA_LANE_INTROS.QUACK}</p>
                        ) : null}
                        <SongbookRationaleList books={lane.quackBooks} label="QUACKsutra songbooks" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </section>

            {flatSections.map((section) => (
              <section
                key={section.sectionKey}
                id={sectionAnchorId(section.sectionKey)}
                className="songbooks-page__section"
                aria-labelledby={`songbooks-section-${section.sectionKey}`}
              >
                <header className="songbooks-page__section-header">
                  <h2
                    id={`songbooks-section-${section.sectionKey}`}
                    className="songbooks-page__section-title catalog-section-title"
                  >
                    {section.title}
                  </h2>
                </header>
                <SongbookThumbGrid
                  books={section.books}
                  label={`${section.title} songbooks`}
                  columns={section.sectionKey === 'genre' ? 'triple' : 'default'}
                />
              </section>
            ))}
          </div>
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
