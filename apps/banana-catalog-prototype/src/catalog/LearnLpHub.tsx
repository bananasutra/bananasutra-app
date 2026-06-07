import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import {
  LEARN_ABOUT_PREVIEW,
  LEARN_HUB_LINKS,
  LEARN_HUB_TILES,
  LEARN_QUOTES,
  coreSutraRowsForHub,
  countWordsCatalog,
  pickMuseSample,
  pickQuoteAtIndex,
  pickQuoteSample,
  pickStageCurtainSongs,
  pickWordsSample,
  type LearnHubTileKey,
} from './learnLpData'
import { useMusesCatalog } from './generatedData'
import { SUTRA_CONTEXT, type SutraFamilyKey, sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { songCatalogLinkTo } from './songPaths'
import type { MuseCatalogItem, QuoteWallItem, SongCatalogItem } from './types'

const SPLIT_MQ = '(min-width: 640px)'

type Props = {
  songCatalog: SongCatalogItem[] | null
}

function LearnHubAboutPanel() {
  return (
    <div className="learn-lp__panel learn-lp__panel--about">
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
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_ABOUT_PREVIEW.href}>
        Read the full story →
      </Link>
    </div>
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
    <div className="learn-lp__panel learn-lp__panel--compact">
      <p className="learn-lp__panel-intro">
        Seven compass questions, KNOW through BOW. Tap a card for the full sutra page.
      </p>
      <div className="learn-lp__sutra-compact-grid">
        {coreSutraRowsForHub().map((key) => (
          <LearnSutraCompact key={key} familyKey={key} />
        ))}
        <LearnSutraCompact familyKey="QUACK" quack />
      </div>
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_HUB_LINKS.sutras}>
        Browse all sutras →
      </Link>
    </div>
  )
}

function LearnHubMusesPanel({ muses, total }: { muses: MuseCatalogItem[]; total: number }) {
  return (
    <div className="learn-lp__panel">
      <p className="learn-lp__panel-intro">
        Thinkers, writers, and fools behind the quotes and songs. {total} muses in the catalog.
      </p>
      <div className="learn-lp__muse-grid">
        {muses.map((m) => (
          <Link key={m.muse_id || m.muse} className="learn-lp__muse-chip" to={LEARN_HUB_LINKS.muses}>
            <span className="learn-lp__muse-chip-name">{m.muse}</span>
            <span className="learn-lp__muse-chip-meta">
              {m.core_sutra} · {m.song_count || 0} song{(m.song_count || 0) === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
      </div>
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_HUB_LINKS.muses}>
        Browse all muses →
      </Link>
    </div>
  )
}

function LearnQuoteSpotlight({
  quotes,
  index,
  onRefresh,
}: {
  quotes: QuoteWallItem[]
  index: number
  onRefresh: () => void
}) {
  const quote = pickQuoteAtIndex(quotes, index)
  if (!quote) return <p className="learn-lp__panel-intro">No quotes in catalog.</p>
  return (
    <div className="learn-lp__quote-spotlight">
      <blockquote className="learn-lp__quote-spotlight-text">&ldquo;{quote.quote}&rdquo;</blockquote>
      <p className="learn-lp__quote-spotlight-attr">
        {quote.muse} · {quote.primary_sutra}
      </p>
      <button type="button" className="learn-lp__quote-spotlight-refresh" onClick={onRefresh}>
        Another quote
      </button>
    </div>
  )
}

function LearnHubQuotesPanel({ quotes }: { quotes: QuoteWallItem[] }) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const sample = useMemo(() => pickQuoteSample(quotes, 12), [quotes])

  return (
    <div className="learn-lp__panel">
      <p className="learn-lp__panel-intro">Lines that sparked songs. Tagged by sutra and topic.</p>
      <LearnQuoteSpotlight
        quotes={sample.length ? sample : quotes}
        index={quoteIndex}
        onRefresh={() => setQuoteIndex((i) => i + 1)}
      />
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_HUB_LINKS.quotes}>
        Browse all quotes →
      </Link>
    </div>
  )
}

function trimExtract(raw: string, max = 120): string {
  const flat = raw.replace(/\n/g, ' / ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}

function LearnHubWordsPanel({ words, total }: { words: SongCatalogItem[]; total: number }) {
  return (
    <div className="learn-lp__panel">
      <p className="learn-lp__panel-intro">
        Lyrics-first songs with no in-app audio yet. {total} in the words catalog.
      </p>
      <ul className="learn-lp__word-list">
        {words.map((w) => (
          <li key={w.lyrics_id}>
            <Link className="learn-lp__word-row" to={songCatalogLinkTo(w.lyrics_title, w.url_slug)}>
              <span className="learn-lp__word-row-title">{w.lyrics_title}</span>
              <span className="learn-lp__word-row-meta">{w.sutra}</span>
              <span className="learn-lp__word-row-extract">
                &ldquo;{trimExtract(w.lyrics_extract || w.summary_short)}&rdquo;
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="learn-lp__panel-note">Words also lives under About in the menu (D-028).</p>
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_HUB_LINKS.words}>
        Read the words →
      </Link>
    </div>
  )
}

function LearnHubManifestoPanel() {
  return (
    <div className="learn-lp__panel">
      <p className="learn-lp__manifesto-lead">Human words. AI as instrument. Creative lineage, not creative theft.</p>
      <p className="learn-lp__manifesto-text">
        Every lyric on this site is written by a human. Suno (and other tools) generate sonic canvas the way a sampler
        generates groove: the philosophy, the questions, and the naked truth in the words are the art. Dylan did not
        invent folk structures. Hip hop did not invent breakbeats. The instrument does not invalidate the authorship.
      </p>
      <p className="learn-lp__manifesto-text">
        Homemade, end to end. If that offends purists on either side, well... it&apos;s bananas.
      </p>
      <Link className="catalog-section-cta learn-lp__panel-cta" to={LEARN_HUB_LINKS.manifestoSong}>
        Read the manifesto song →
      </Link>
    </div>
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
  museSample,
  quotePool,
  wordsSample,
  wordsTotal,
  museTotal,
}: {
  tileKey: LearnHubTileKey
  songCatalog: SongCatalogItem[] | null
  museSample: MuseCatalogItem[]
  quotePool: QuoteWallItem[]
  wordsSample: SongCatalogItem[]
  wordsTotal: number
  museTotal: number
}) {
  switch (tileKey) {
    case 'about':
      return <LearnHubAboutPanel />
    case 'sutras':
      return <LearnHubSutrasPanel />
    case 'muses':
      return <LearnHubMusesPanel muses={museSample} total={museTotal} />
    case 'quotes':
      return <LearnHubQuotesPanel quotes={quotePool} />
    case 'words':
      return <LearnHubWordsPanel words={wordsSample} total={wordsTotal} />
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
  const museSample = useMemo(() => pickMuseSample(musesCatalog, 6), [musesCatalog])
  const quotePool = LEARN_QUOTES
  const wordsSample = useMemo(() => pickWordsSample(songCatalog, 3), [songCatalog])
  const wordsTotal = useMemo(() => countWordsCatalog(songCatalog), [songCatalog])
  const museTotal = musesCatalog?.length ?? 0
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
        museSample={museSample}
        quotePool={quotePool}
        wordsSample={wordsSample}
        wordsTotal={wordsTotal}
        museTotal={museTotal}
      />
    ),
    [museSample, museTotal, quotePool, songCatalog, wordsSample, wordsTotal],
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
        Start with the why
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
