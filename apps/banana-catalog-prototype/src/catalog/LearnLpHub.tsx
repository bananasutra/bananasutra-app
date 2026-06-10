import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import {
  LEARN_ABOUT_PREVIEW,
  LEARN_HUB_LINKS,
  LEARN_HUB_STAGE_INTRO,
  LEARN_HUB_TILES,
  LEARN_QUOTES,
  coreSutraRowsForHub,
  pickQuoteAtIndex,
  pickMuseSample,
  pickQuoteSample,
  pickStageCurtainSongs,
  pickWordsSample,
  type LearnHubTileKey,
} from './learnLpData'
import { MANIFESTO_FRAMEWORK, MANIFESTO_LEARN_TEASER } from './manifestoContent'
import { useMusesCatalog } from './generatedData'
import { SUTRA_CONTEXT, type SutraFamilyKey, sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { songCatalogLinkTo } from './songPaths'
import { ScrollRevealSection } from './ScrollRevealSection'
import type { QuoteWallItem, SongCatalogItem } from './types'

const SPLIT_MQ = '(min-width: 640px)'

type Props = {
  songCatalog: SongCatalogItem[] | null
}

function museHref(museName: string): string {
  const slug = museName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${LEARN_HUB_LINKS.muses}#muse-${slug}`
}

function LearnHubStagePanel({
  children,
  footer,
  bodyClassName,
}: {
  children: ReactNode
  footer: ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="learn-lp__panel learn-lp__panel--stage">
      <div className={`learn-lp__panel-stage-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
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
      <p className="learn-lp__panel-text">{LEARN_ABOUT_PREVIEW.homemade}</p>
    </LearnHubStagePanel>
  )
}

function LearnSutraPreview({
  familyKey,
  quack = false,
}: {
  familyKey: SutraFamilyKey
  quack?: boolean
}) {
  const entry = SUTRA_CONTEXT[familyKey]
  const tone = sutraClassName(entry.sutra)
  return (
    <Link
      className={`learn-lp__sutra-preview ${tone}${quack ? ' learn-lp__sutra-preview--quack' : ''}`}
      to={sutraHrefForFamily(familyKey)}
      data-sutra-key={familyKey}
    >
      <span className="learn-lp__sutra-preview-name">
        {quack ? `${entry.sutra} · sub of BLOW` : entry.sutra}
      </span>
      <span className="learn-lp__sutra-preview-q">{entry.question}</span>
    </Link>
  )
}

function LearnHubSutrasPanel() {
  const intro = LEARN_HUB_STAGE_INTRO.sutras
  return (
    <LearnHubStagePanel
      footer={
        <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.sutras}>
          Browse all sutras →
        </Link>
      }
    >
      <p className="learn-lp__panel-intro">{intro.lead}</p>
      <p className="learn-lp__panel-text">{intro.support}</p>
      <div className="learn-lp__sutra-preview-grid">
        {coreSutraRowsForHub().map((key) => (
          <LearnSutraPreview key={key} familyKey={key} />
        ))}
        <LearnSutraPreview familyKey="QUACK" quack />
      </div>
    </LearnHubStagePanel>
  )
}

function LearnHubMusesQuotesPanel({ quotes }: { quotes: QuoteWallItem[] }) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const { data: musesCatalog } = useMusesCatalog()
  const sample = useMemo(() => pickQuoteSample(quotes, 24), [quotes])
  const pool = sample.length ? sample : quotes
  const quote = pickQuoteAtIndex(pool, quoteIndex)
  const museSample = useMemo(() => pickMuseSample(musesCatalog, 5), [musesCatalog])

  const intro = LEARN_HUB_STAGE_INTRO.musesQuotes

  if (!quote) return <p className="learn-lp__panel-intro">No quotes in catalog.</p>

  return (
    <LearnHubStagePanel
      bodyClassName="learn-lp__panel-stage-body--muses"
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
          <Link className="learn-lp__panel-secondary-btn" to={LEARN_HUB_LINKS.muses}>
            Browse muses →
          </Link>
          <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.quotes}>
            Browse all quotes →
          </Link>
        </>
      }
    >
      <p className="learn-lp__panel-intro">{intro.lead}</p>
      <p className="learn-lp__panel-text">{intro.support}</p>
      <div className="learn-lp__quote-stage-card">
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
      {museSample.length ? (
        <div className="learn-lp__muse-chip-strip">
          {museSample.map((muse) => (
            <Link key={muse.muse_id || muse.muse} className="learn-lp__muse-chip" to={museHref(muse.muse)}>
              <span className="learn-lp__muse-chip-name">{muse.muse}</span>
              {muse.song_count > 0 ? (
                <span className="learn-lp__muse-chip-meta">
                  {muse.song_count} {muse.song_count === 1 ? 'song' : 'songs'}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </LearnHubStagePanel>
  )
}

function LearnHubWordsPanel({ words }: { words: SongCatalogItem[] }) {
  const intro = LEARN_HUB_STAGE_INTRO.words
  return (
    <LearnHubStagePanel
      bodyClassName="learn-lp__panel-stage-body--words"
      footer={
        <Link className="learn-lp__panel-cta-btn" to={LEARN_HUB_LINKS.words}>
          Read the words →
        </Link>
      }
    >
      <p className="learn-lp__panel-intro">{intro.lead}</p>
      <p className="learn-lp__panel-text">{intro.support}</p>
      <ul className="learn-lp__word-list">
        {words.map((song) => {
          const teaser = (song.summary_short || song.lyrics_extract || '').trim()
          return (
            <li key={song.lyrics_id}>
              <Link
                className="learn-lp__word-row"
                to={songCatalogLinkTo(song.lyrics_title, song.url_slug)}
              >
                <span className="learn-lp__word-row-title">{song.lyrics_title}</span>
                {song.sutra.trim() ? (
                  <span className={`learn-lp__word-row-meta catalog-sutra-word ${sutraClassName(song.sutra.trim())}`}>
                    {song.sutra.trim()}
                  </span>
                ) : null}
                {teaser ? <span className="learn-lp__word-row-extract">{teaser}</span> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </LearnHubStagePanel>
  )
}

function LearnHubManifestoPanel() {
  const intro = LEARN_HUB_STAGE_INTRO.manifesto
  return (
    <LearnHubStagePanel
      bodyClassName="learn-lp__panel-stage-body--manifesto"
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
      <p className="learn-lp__panel-intro">{intro.lead}</p>
      <blockquote className="learn-lp__manifesto-teaser-quote">{MANIFESTO_LEARN_TEASER.pullQuote}</blockquote>
      <ul className="learn-lp__manifesto-pillar-strip">
        {MANIFESTO_FRAMEWORK.map((pillar) => (
          <li key={pillar.name} className="learn-lp__manifesto-pillar">
            <span className="learn-lp__manifesto-pillar-name">{pillar.name}</span>
            <span className="learn-lp__manifesto-pillar-sub">{pillar.sub}</span>
          </li>
        ))}
      </ul>
      <p className="learn-lp__panel-text">{intro.support}</p>
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
  quotePool,
  wordsSample,
}: {
  tileKey: LearnHubTileKey
  songCatalog: SongCatalogItem[] | null
  quotePool: QuoteWallItem[]
  wordsSample: SongCatalogItem[]
}) {
  switch (tileKey) {
    case 'about':
      return <LearnHubAboutPanel />
    case 'sutras':
      return <LearnHubSutrasPanel />
    case 'muses-quotes':
      return <LearnHubMusesQuotesPanel quotes={quotePool} />
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

  const quotePool = LEARN_QUOTES
  const wordsSample = useMemo(() => pickWordsSample(songCatalog, 3), [songCatalog])
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
        quotePool={quotePool}
        wordsSample={wordsSample}
      />
    ),
    [quotePool, songCatalog, wordsSample],
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
    <ScrollRevealSection
      immediate
      className="learn-lp__hub-section"
      aria-labelledby="learn-lp-hub-heading"
    >
      <h2 id="learn-lp-hub-heading" className="catalog-section-title">
        The seeds
      </h2>
      <p className="catalog-lp-section-intro">
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
    </ScrollRevealSection>
  )
}
