import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import {
  LEARN_ABOUT_PREVIEW,
  LEARN_HUB_LINKS,
  LEARN_HUB_TILES,
  LEARN_QUOTES,
  coreSutraRowsForHub,
  pickQuoteAtIndex,
  pickQuoteSample,
  pickStageCurtainSongs,
  pickWordsSample,
  type LearnHubTileKey,
} from './learnLpData'
import { MANIFESTO_LEARN_TEASER } from './manifestoContent'
import { useMusesCatalog } from './generatedData'
import { SUTRA_CONTEXT, type SutraFamilyKey, sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { songCatalogLinkTo } from './songPaths'
import type { MuseCatalogItem, QuoteWallItem, SongCatalogItem } from './types'

const SPLIT_MQ = '(min-width: 640px)'

type Props = {
  songCatalog: SongCatalogItem[] | null
}

function LearnHubStagePanel({
  children,
  footer,
}: {
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="learn-lp__panel learn-lp__panel--stage">
      <div className="learn-lp__panel-stage-body">{children}</div>
      <div className="learn-lp__panel-stage-footer">{footer}</div>
    </div>
  )
}

function LearnHubAboutPanel() {
  return (
    <LearnHubStagePanel
      footer={
        <Link className="learn-lp__panel-cta-btn" to={LEARN_ABOUT_PREVIEW.href}>
          Read the full story →
        </Link>
      }
    >
      <p className="learn-lp__panel-lead">{LEARN_ABOUT_PREVIEW.lead}</p>
      <p className="learn-lp__panel-text">{LEARN_ABOUT_PREVIEW.zappa}</p>
      <p className="learn-lp__panel-text">{LEARN_ABOUT_PREVIEW.compass}</p>
      <p className="learn-lp__panel-text">
        BANANASUTRA is a living collection: homemade, end to end. Songs with real meaning, sorted by seven guiding
        questions, not by algorithm or mood.
      </p>
      <p className="learn-lp__panel-text">
        Every song belongs to a sutra. Together they form a compass for a world gone bananas.
      </p>
    </LearnHubStagePanel>
  )
}

function LearnSutraCompact({
  familyKey,
  quack = false,
}: {
  familyKey: SutraFamilyKey
  quack?: boolean
}) {
  const entry = SUTRA_CONTEXT[familyKey]
  const tone = sutraClassName(entry.sutra)
  const when = (entry.sutra_when || '').trim()
  return (
    <Link
      className={`learn-lp__sutra-compact ${tone}${quack ? ' learn-lp__sutra-compact--quack' : ''}`}
      to={sutraHrefForFamily(familyKey)}
      data-sutra-key={familyKey}
    >
      <span className="learn-lp__sutra-compact-head">
        <span className="learn-lp__sutra-compact-name">
          {quack ? `${entry.sutra} · sub of BLOW` : entry.sutra}
        </span>
        <span className="learn-lp__sutra-compact-practice">{entry.practice}</span>
      </span>
      <span className="learn-lp__sutra-compact-q">{entry.question}</span>
      {when ? <span className="learn-lp__sutra-compact-when">{when}</span> : null}
    </Link>
  )
}

function LearnHubSutrasPanel() {
  return (
    <LearnHubStagePanel
      footer={
        <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.sutras}>
          Browse all sutras →
        </Link>
      }
    >
      <p className="learn-lp__panel-intro">
        Seven compass questions, KNOW through BOW. Tap a card for the full sutra page.
      </p>
      <div className="learn-lp__sutra-compact-grid">
        {coreSutraRowsForHub().map((key) => (
          <LearnSutraCompact key={key} familyKey={key} />
        ))}
        <LearnSutraCompact familyKey="QUACK" quack />
      </div>
    </LearnHubStagePanel>
  )
}

function LearnHubMusesQuotesPanel({
  quotes,
  muses,
}: {
  quotes: QuoteWallItem[]
  muses: MuseCatalogItem[] | null
}) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const sample = useMemo(() => pickQuoteSample(quotes, 24), [quotes])
  const pool = sample.length ? sample : quotes
  const quote = pickQuoteAtIndex(pool, quoteIndex)

  const museEntry = useMemo(() => {
    if (!quote?.muse || !muses?.length) return null
    const name = quote.muse.trim().toLowerCase()
    return muses.find((m) => (m.muse || '').trim().toLowerCase() === name) ?? null
  }, [muses, quote?.muse])

  if (!quote) return <p className="learn-lp__panel-intro">No quotes in catalog.</p>

  const museSummary =
    (museEntry?.notes || museEntry?.famous_works || '').trim() ||
    'Thinkers, writers, and fools behind the lines that became songs.'

  return (
    <LearnHubStagePanel
      footer={
        <>
          <button
            type="button"
            className="learn-lp__panel-secondary-btn"
            aria-label="Show another quote"
            onClick={() => setQuoteIndex((i) => i + 1)}
          >
            <span className="learn-lp__quote-refresh-icon" aria-hidden>
              ↻
            </span>
            Another quote
          </button>
          <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.quotes}>
            Browse all quotes →
          </Link>
        </>
      }
    >
      <div className="learn-lp__quote-feature">
        <blockquote className="learn-lp__quote-feature-text">&ldquo;{quote.quote}&rdquo;</blockquote>
        <p className="learn-lp__quote-feature-meta">
          <span className="learn-lp__quote-feature-muse">{quote.muse}</span>
          {quote.primary_sutra ? (
            <>
              <span aria-hidden> · </span>
              <span className={`catalog-sutra-word ${sutraClassName(quote.primary_sutra)}`}>{quote.primary_sutra}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="learn-lp__muse-summary">
        <p className="learn-lp__muse-summary-label">About {quote.muse}</p>
        <p className="learn-lp__muse-summary-text">{museSummary}</p>
      </div>
    </LearnHubStagePanel>
  )
}

function LearnHubWordsPanel({ words }: { words: SongCatalogItem[] }) {
  return (
    <LearnHubStagePanel
      footer={
        <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.words}>
          Read the words →
        </Link>
      }
    >
      <h3 className="learn-lp__words-panel-title">What&apos;s new in the library?</h3>
      <div className="learn-lp__words-grid">
        {words.map((song) => {
          const secondaryMeta = [song.topic, song.intention, song.light_shadow]
            .map((value) => value.trim())
            .filter(Boolean)
          const secondaryLine = secondaryMeta.join(' · ')
          return (
            <Link
              key={song.lyrics_id}
              className="words-card words-card-link learn-lp__words-card"
              to={songCatalogLinkTo(song.lyrics_title, song.url_slug)}
            >
              <div className="words-card__text">
                <h4 className="words-card__title song-title">{song.lyrics_title}</h4>
                {song.summary_short ? <p className="words-card__summary">{song.summary_short}</p> : null}
                <div className="words-card__meta catalog-card-meta">
                  {song.sutra.trim() ? (
                    <span className={`catalog-sutra-word ${sutraClassName(song.sutra.trim())}`}>{song.sutra.trim()}</span>
                  ) : null}
                  {secondaryLine ? (
                    <span className="catalog-card-meta-secondary" title={secondaryLine}>
                      {secondaryLine}
                    </span>
                  ) : null}
                </div>
              </div>
              {song.cover_image_url ? (
                <div className="words-card__thumb" aria-hidden>
                  <img src={coverImageUrl(song.cover_image_url, { width: 200 })} alt="" loading="lazy" width={120} height={120} />
                </div>
              ) : null}
            </Link>
          )
        })}
      </div>
    </LearnHubStagePanel>
  )
}

function LearnHubManifestoPanel() {
  return (
    <LearnHubStagePanel
      footer={
        <>
          <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.manifesto}>
            Read the full manifesto →
          </Link>
          <Link className="learn-lp__panel-secondary-btn learn-lp__manifesto-song-link" to={LEARN_HUB_LINKS.manifestoSong}>
            Read the manifesto song →
          </Link>
        </>
      }
    >
      <blockquote className="learn-lp__manifesto-teaser-quote">{MANIFESTO_LEARN_TEASER.pullQuote}</blockquote>
      <p className="learn-lp__manifesto-framework-labels">{MANIFESTO_LEARN_TEASER.frameworkLabels}</p>
    </LearnHubStagePanel>
  )
}

function LearnStageCurtain({ songs }: { songs: SongCatalogItem[] }) {
  if (!songs.length) {
    return <p className="learn-lp__stage-empty">Pick a door to preview.</p>
  }
  return (
    <div className="learn-lp__stage-curtain" aria-label="Album art curtain">
      {songs.map((song) => {
        const cover = coverImageUrl(song.cover_image_url, { width: 200 })
        return (
          <div key={song.lyrics_id} className="learn-lp__stage-curtain-item">
            {cover ? <img src={cover} alt="" loading="lazy" decoding="async" /> : null}
          </div>
        )
      })}
    </div>
  )
}

function LearnHubPanelContent({
  tileKey,
  songCatalog,
  musesCatalog,
  quotePool,
  wordsSample,
}: {
  tileKey: LearnHubTileKey
  songCatalog: SongCatalogItem[] | null
  musesCatalog: MuseCatalogItem[] | null
  quotePool: QuoteWallItem[]
  wordsSample: SongCatalogItem[]
}) {
  switch (tileKey) {
    case 'about':
      return <LearnHubAboutPanel />
    case 'sutras':
      return <LearnHubSutrasPanel />
    case 'muses-quotes':
      return <LearnHubMusesQuotesPanel quotes={quotePool} muses={musesCatalog} />
    case 'words':
      return <LearnHubWordsPanel words={wordsSample} />
    case 'manifesto':
      return <LearnHubManifestoPanel />
    default:
      return songCatalog ? <LearnStageCurtain songs={pickStageCurtainSongs(songCatalog, 30)} /> : null
  }
}

export function LearnLpHub({ songCatalog }: Props) {
  const stageRef = useRef<HTMLElement>(null)
  const [activeKey, setActiveKey] = useState<LearnHubTileKey | null>(null)
  const [stageSwap, setStageSwap] = useState(false)
  const [splitLayout, setSplitLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SPLIT_MQ).matches,
  )

  const { data: musesCatalog } = useMusesCatalog()
  const quotePool = LEARN_QUOTES
  const wordsSample = useMemo(() => pickWordsSample(songCatalog, 5), [songCatalog])
  const curtainSongs = useMemo(() => pickStageCurtainSongs(songCatalog, 30), [songCatalog])

  useEffect(() => {
    const mq = window.matchMedia(SPLIT_MQ)
    const onChange = () => setSplitLayout(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (window.location.hash !== '#manifesto') return
    const timer = window.setTimeout(() => {
      document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveKey('manifesto')
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  const renderPanel = useCallback(
    (key: LearnHubTileKey) => (
      <LearnHubPanelContent
        tileKey={key}
        songCatalog={songCatalog}
        musesCatalog={musesCatalog}
        quotePool={quotePool}
        wordsSample={wordsSample}
      />
    ),
    [musesCatalog, quotePool, songCatalog, wordsSample],
  )

  const selectTile = (key: LearnHubTileKey) => {
    if (activeKey === key) {
      setActiveKey(null)
      return
    }
    setActiveKey(key)
    if (splitLayout) {
      setStageSwap(true)
      window.requestAnimationFrame(() => {
        window.setTimeout(() => setStageSwap(false), 280)
      })
    }
  }

  const stageContent =
    activeKey && splitLayout ? (
      renderPanel(activeKey)
    ) : (
      <LearnStageCurtain songs={curtainSongs} />
    )

  return (
    <section className="catalog-page-shell__section learn-lp__hub-section" aria-labelledby="learn-lp-hub-heading">
      <h2 id="learn-lp-hub-heading" className="catalog-section-title">
        The seeds
      </h2>
      <p className="learn-lp__section-intro">
        Orientation, not index. Tap a door to see what&apos;s inside before you commit.
      </p>

      <div className="learn-lp__hub">
        <div className="learn-lp__hub-tiles" role="list">
          {LEARN_HUB_TILES.map((tile) => {
            const isActive = activeKey === tile.key
            const isOpen = !splitLayout && isActive
            return (
              <article
                key={tile.key}
                id={tile.anchorId}
                className={`learn-lp__tile${tile.tileClassName ? ` ${tile.tileClassName}` : ''}${isActive ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
                data-learn-tile={tile.key}
                role="listitem"
              >
                <button
                  type="button"
                  className="learn-lp__tile-btn"
                  aria-expanded={splitLayout ? isActive : isOpen}
                  aria-controls={`learn-lp-drawer-${tile.key} learn-lp-stage`}
                  onClick={() => selectTile(tile.key)}
                >
                  <span className="learn-lp__tile-chev" aria-hidden="true" />
                  <span className="learn-lp__tile-label">{tile.label}</span>
                  <span className="learn-lp__tile-desc">{tile.description}</span>
                </button>
                {!splitLayout ? (
                  <div className="learn-lp__tile-drawer" id={`learn-lp-drawer-${tile.key}`}>
                    {isOpen ? renderPanel(tile.key) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>

        <aside
          ref={stageRef}
          id="learn-lp-stage"
          className={`learn-lp__hub-stage${activeKey && splitLayout ? '' : ' is-empty'}${stageSwap ? ' is-swapping' : ''}${!activeKey && curtainSongs.length ? ' has-curtain' : ''}`}
          aria-live="polite"
          aria-label="Preview"
        >
          {stageContent}
        </aside>
      </div>
    </section>
  )
}
