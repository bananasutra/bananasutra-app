import { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { buildSutraStats } from './sutraPageUtils'
import type { SutraContextEntry, SutraFamilyKey } from './sutraContext'
import { SUTRA_CONTEXT, SUTRA_INDEX_CORE_ORDER, sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { usePageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import './CatalogApp.css'
import './AboutPage.css'

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function AboutSutraMatrixCard({
  familyKey,
  entry,
  stats,
  itemClassName,
}: {
  familyKey: SutraFamilyKey
  entry: SutraContextEntry
  stats: { songs: number; tracks: number }
  itemClassName?: string
}) {
  const tone = sutraClassName(entry.sutra)
  const sutraDisplayName = (entry.sutra || '').trim() || familyKey
  return (
    <Link
      className={`about-page__sutra-list-item ${tone}${itemClassName ? ` ${itemClassName}` : ''}`.trim()}
      to={sutraHrefForFamily(familyKey)}
    >
      <div className="about-page__sutra-list-heading">
        <div className="about-page__sutra-list-head">
          <span className="about-page__sutra-list-primary">
            <span className="about-page__sutra-list-sutra">{sutraDisplayName}</span>
            <span className="about-page__sutra-list-question">
              <span className="about-page__sutra-list-dot" aria-hidden>
                ·
              </span>
              {entry.question}
              <span className="about-page__sutra-list-dot" aria-hidden>
                ·
              </span>
            </span>
          </span>
        </div>
        <div className="about-page__sutra-list-sub">
          {entry.practice}
          <span className="about-page__sutra-list-dot" aria-hidden>
            ·
          </span>
          {entry.themes}
        </div>
      </div>
      {(entry.sutra_when || '').trim() || (entry.sutra_card_essence || '').trim() ? (
        <div className="about-page__sutra-list-meta">
          {(entry.sutra_when || '').trim() ? (
            <p className="about-page__sutra-list-when">{entry.sutra_when.trim()}</p>
          ) : null}
          {(entry.sutra_card_essence || '').trim() ? (
            <p className="about-page__sutra-list-essence">{entry.sutra_card_essence.trim()}</p>
          ) : null}
        </div>
      ) : null}
      <p className="about-page__sutra-list-counts">
        {formatCount(stats.songs)} songs · {formatCount(stats.tracks)} tracks
      </p>
      <span className="about-page__sutra-list-cta" aria-hidden>
        Explore {sutraDisplayName} →
      </span>
    </Link>
  )
}

const ABOUT_JUMP_NAV_ITEMS = [
  { id: 'what', label: 'What is Bananasutra', mobileLabel: 'What is?' },
  { id: 'sutras', label: 'The seven sutras', mobileLabel: '7 Sutras' },

  { id: 'who', label: 'Who is behind it', mobileLabel: 'Who?' },
  { id: 'colophon', label: 'Colophon' },
] as const

export function AboutPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()

  usePageMeta({
    title: 'About the Sutras',
    description:
      'What is BANANASUTRA? Seven sutras — KNOW, BLOW, SHOW, FLOW, GROW, GLOW, and QUACK — songs for a world gone bananas.',
    path: '/about',
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  useEffect(() => {
    if (location.hash !== '#sutras') return
    const el = document.getElementById('sutras')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.pathname, location.hash])

  const sutraStats = useMemo(() => {
    if (!songCatalogRows) return new Map()
    return buildSutraStats(songCatalogRows)
  }, [songCatalogRows])

  if (catalogLoading) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">Loading…</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (catalogError || !songCatalogRows) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogError ?? 'Could not load catalog data.'}</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <article className="about-page catalog-layout-shell" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              About
            </span>
          </nav>

          <header className="catalog-page-intro">
            <h1 className="catalog-page-h1">Ideas you can feel.</h1>
            <p className="catalog-page-sub">
              Songs for a world gone bananas—each one rooted in a question and written with purpose.
            </p>
          </header>

          <div className="catalog-page-shell__jump-region">
            <CatalogPageJumpNav items={[...ABOUT_JUMP_NAV_ITEMS]} />
          </div>

          <div className="about-page__body">
            <section className="about-page__section" aria-labelledby="what">
              <h2 id="what" className="catalog-section-title about-page__anchor-target">
                What is Bananasutra
              </h2>
              <div className="about-page__prose">
                <p>
                  Probably not what you think. &ldquo;Banana&rdquo; is slang for crazy, chaos, and the emoji speaks for
                  itself in a world run mostly by men whose logic starts south of the belt. &ldquo;Sutra&rdquo; means
                  teaching, thread, story. Put them together: stories that matter, in a world gone bananas.
                </p>
                <p>
                  BANANASUTRA is a living collection of songs organized by meaning, not genre. Every song has a sutra (a
                  guiding question), a topic, sometimes a muse, sometimes a character, and a short paragraph on why it
                  exists. The collection is meaning-first: not sorted by algorithm or mood, but by the question each
                  song is trying to ask.
                </p>
                <p>
                  I invented the sutras to help me remember what matters. The corporate algorithm wants us numb. Empathy
                  gets called naive. Lying is strategy. The seven sutras are my compass, seven north stars I can defend
                  and return to. They aren&apos;t taxonomy. They&apos;re a tool for staying sane.
                </p>
                <p>
                  I believe music is the most universal language. I believe creativity is intelligence having fun
                  (thanks, maybe-Einstein). And I believe songs with real meaning can help people get and stay more
                  connected, more aware, more brave, in the deadly jungle of corporate nonsense ruled by apes gone
                  wrong.
                </p>
              </div>
            </section>

            <section className="about-page__section" aria-labelledby="sutras">
              <h2 id="sutras" className="catalog-section-title about-page__anchor-target">
                The seven sutras
              </h2>
              <div className="about-page__prose">
                <p>
                  Each sutra is a question, a practice, an intention. The sutras are a framework, with seven guiding
                  principles for navigating a world that keeps moving the goalposts. Used on ourselves, it&apos;s a
                  compass. An awareness tool for staying conscious and balanced, for choosing our north star at any
                  given moment. Used on a room, it&apos;s a shared language. A translator for understanding each
                  other&apos;s moods, beliefs, motivations, and boundaries.
                </p>
                <p>
                  The mindset is rooted in radical honesty, natural empathy, and the idea that playing infinite games
                  is much smarter than playing finite games. Seven commandments for a world gone bombastic, fostering
                  curiosity, humility, respect, trust, and joy. In other words: long-term peace and happiness.
                </p>
                <p>
                  <strong>Why seven?</strong> I didn&apos;t pick seven. I noticed seven. Seven distinct points of view
                  that keep emerging,
                  seven action verbs that drive core human behaviors. The eighth is an anomaly, a specific failure of the
                  BLOWsutra mode, about a dumb duck dead set on dismantling democracy for nothing but finite, puerile
                  aims. I call that one QUACKsutra.
                </p>
              </div>

              <div className="about-page__sutra-matrix">
                <ul className="about-page__sutra-list" aria-label="The seven sutras with question, practice, and themes">
                  {SUTRA_INDEX_CORE_ORDER.map((key) => {
                    const entry = SUTRA_CONTEXT[key]
                    const stats = sutraStats.get(key) ?? { songs: 0, tracks: 0 }
                    return (
                      <li key={key}>
                        <AboutSutraMatrixCard familyKey={key} entry={entry} stats={stats} />
                      </li>
                    )
                  })}
                </ul>

                <div className="about-page__sutra-quack-wrap">
                  <p className="about-page__sutra-quack-kicker">
                    Sub-sutra of BLOWsutra · not one of the seven core lanes
                  </p>
                  <p className="about-page__sutra-quack-intro">
                    QUACKsutra isn&apos;t a sutra in the same sense as the seven above—it&apos;s a BLOWsutra
                    sub-sutra—but it still spans a large songbook and speaks directly to real, urgent issues. It
                    deserves its own block, kept last so the core compass stays clear.
                  </p>
                  <AboutSutraMatrixCard
                    familyKey="QUACK"
                    entry={SUTRA_CONTEXT.QUACK}
                    stats={sutraStats.get('QUACK') ?? { songs: 0, tracks: 0 }}
                    itemClassName="about-page__sutra-list-item--quack"
                  />
                </div>
              </div>
            </section>


            <section className="about-page__section" aria-labelledby="who">
              <h2 id="who" className="catalog-section-title about-page__anchor-target">
                Who is behind it
              </h2>
              <div className="about-page__prose">
                <p>
                  One person. Philosophy and math background (the combo of curiosity and rigor that makes you question
                  everything, then prove it). I write the lyrics, prompt the music, clone my own voice for the dubs,
                  make the cover art and videos, and built this app. 400+ songs, 2000+ tracks, in 2 years. Not bragging,
                  just clarifying: this whole thing is homemade, end to end.
                </p>
                <p>
                  Why? Because I agree with Frank Zappa: music is the only religion that delivers the goods.
                </p>
              </div>
            </section>

            <section className="about-page__section about-page__section--colophon" aria-labelledby="colophon">
              <h2 id="colophon" className="catalog-section-title about-page__anchor-target">
                Colophon
              </h2>
              <dl className="about-page__colophon-list">
                <div className="about-page__colophon-row">
                  <dt className="about-page__colophon-label">Lyrics</dt>
                  <dd className="about-page__colophon-value">
                    100% human-written. Every word is mine. The stories, the wordplay, the rage, the tenderness. All of
                    it.
                  </dd>
                </div>
                <div className="about-page__colophon-row">
                  <dt className="about-page__colophon-label">Music</dt>
                  <dd className="about-page__colophon-value">
                    Produced with Suno, an AI music tool. I write detailed prompts describing genre, mood,
                    instrumentation, structure, tempo. Think of it like directing a session musician who never gets
                    tired. Sometimes it takes 20+ generations to get a track right. The AI does not write lyrics or
                    decide what the song is about. Ever.
                  </dd>
                </div>
                <div className="about-page__colophon-row">
                  <dt className="about-page__colophon-label">Voice</dt>
                  <dd className="about-page__colophon-value">
                    French-American voiceover dub, cloned from my own voice for consistency across the catalog.
                  </dd>
                </div>
                <div className="about-page__colophon-row">
                  <dt className="about-page__colophon-label">Cover art &amp; videos</dt>
                  <dd className="about-page__colophon-value">
                    Made by me using a mix of AI image tools, video editors, and stubbornness.
                  </dd>
                </div>
                <div className="about-page__colophon-row">
                  <dt className="about-page__colophon-label">This app</dt>
                  <dd className="about-page__colophon-value">
                    React + TypeScript (Vite, React Router), powered by Airtable as CMS, with Python scripts for data
                    processing. Built with Cursor and Claude. Embeds from SoundCloud and YouTube. Catalog numbers,
                    filters, and embeds reflect a dated export, not a live mirror. The site footer shows the snapshot
                    date.
                  </dd>
                </div>
              </dl>
              <p className="about-page__colophon-tldr">
                <strong>In short:</strong> the ideas are human. The tools are whatever gets the job done. If that
                offends purists on either side, well… it&apos;s bananas.
              </p>
            </section>
          </div>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
