import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { allSongbooks, songbookHref } from './songbooks'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'
import { usePageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
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
            src={book.playlist_artwork_url}
            alt=""
            width={280}
            height={280}
            loading="lazy"
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
      </div>
    </Link>
  )
}

export function SongbooksPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  usePageMeta({
    title: 'Songbooks & Playlists',
    description: 'Curated SoundCloud playlists that tell a story. By topic, by genre, and by language.',
    path: '/songbooks',
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  const songbooks = useMemo(() => [...allSongbooks()].sort(sortBooks), [])

  const sections = useMemo(() => {
    const bySection = new Map<SongbookSectionKey, ListedSongbook[]>()
    for (const key of SECTION_ORDER) bySection.set(key, [])
    for (const book of songbooks) {
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
  }, [songbooks])

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

          <div className="catalog-page-shell__jump-region">
            <CatalogPageJumpNav items={jumpNavItems} />
          </div>

          <div className="songbooks-page__sections" aria-label="Songbook sections by type">
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
