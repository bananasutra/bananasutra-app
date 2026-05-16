import { Link } from 'react-router-dom'
import { buildSutraStats } from './sutraPageUtils'
import type { SutraContextEntry, SutraFamilyKey } from './sutraContext'
import { SUTRA_CONTEXT, SUTRA_INDEX_CORE_ORDER, sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { renderPageMeta } from './usePageMeta'
import { useSongCatalogBrowse } from './generatedData'
import { useMemo } from 'react'

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

export function AboutSutrasContent() {
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalogBrowse()

  const pageMeta = renderPageMeta({
    title: 'The Seven Sutras',
    description: 'Explore the seven BANANASUTRA sutras, the questions behind them, and the songs they organize.',
    path: '/about/sutras',
  })

  const sutraStats = useMemo(() => {
    if (!songCatalogRows) return new Map()
    return buildSutraStats(songCatalogRows)
  }, [songCatalogRows])

  if (catalogLoading) {
    return <p className="about-page__prose">Loading sutra counts...</p>
  }

  if (catalogError || !songCatalogRows) {
    return <p className="about-page__prose">{catalogError ?? 'Could not load catalog data.'}</p>
  }

  return (
    <div className="about-page__body">
      {pageMeta}
      <section className="about-page__section" aria-labelledby="sutras">
        <h2 id="sutras" className="catalog-section-title about-page__anchor-target">
          The seven sutras
        </h2>
        <div className="about-page__prose">
          <p>
            Each sutra is a question, a practice, an intention. The sutras are a framework, with seven guiding
            principles for navigating a world that keeps moving the goalposts. Used on ourselves, it&apos;s a compass. An
            awareness tool for staying conscious and balanced, for choosing our north star at any given moment. Used on
            a room, it&apos;s a shared language. A translator for understanding each other&apos;s moods, beliefs,
            motivations, and boundaries.
          </p>
          <p>
            The mindset is rooted in radical honesty, natural empathy, and the idea that playing infinite games is much
            smarter than playing finite games. Seven commandments for a world gone bombastic, fostering curiosity,
            humility, respect, trust, and joy. In other words: long-term peace and happiness.
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
            <p className="about-page__sutra-quack-intro">
              <strong>Why seven?</strong> I didn&apos;t pick seven. I noticed seven. Seven distinct points of view that
              keep emerging, seven action verbs that drive core human behaviors. The eighth is an anomaly, a specific
              failure of the BLOWsutra mode, about a dumb duck dead set on dismantling democracy for nothing but finite,
              puerile aims. I call that one QUACKsutra.
            </p>
            <p className="about-page__sutra-quack-kicker">Sub-sutra of BLOWsutra · not one of the seven core lanes</p>
            <p className="about-page__sutra-quack-intro">
              QUACKsutra isn&apos;t a sutra in the same sense as the seven above, it&apos;s a BLOWsutra sub-sutra, but
              it still spans a large songbook and speaks directly to real, urgent issues. It deserves its own block,
              kept last so the core compass stays clear.
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
    </div>
  )
}
