import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { songMatchesMediaCombo } from './filterSongs'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { filterYoutubeVideosBySearchQuery } from './searchMatch'
import { songCatalogLinkTo } from './songPaths'
import { sutraClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import type { SongCatalogItem, YouTubeCatalogVideo } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { coverImageUrl } from '../seo/imageUrl'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { ScrollRail } from './ScrollRail'
import { CatalogPager } from './CatalogPager'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
import { featuredYoutubeSongPageHref } from './featuredYoutubeSongPageHref'
import './CatalogPager.css'
import './CatalogApp.css'
import './VideosPage.css'
import { useSongCatalog } from './generatedData'

const VIDEO_PAGE_SIZE = 30
const FIND_DEBOUNCE_MS = 350

function buildSongMapByLyricsId(songCatalog: SongCatalogItem[]): Map<string, SongCatalogItem> {
  const m = new Map<string, SongCatalogItem>()
  for (const s of songCatalog) {
    const id = (s.lyrics_id || '').trim()
    if (id) m.set(id, s)
  }
  return m
}

/** Video-specific media filter — intentionally simpler than the songs-page version. */
type VideoMediaFilter = 'all' | 'has_sc'

/** Returns true when the video's linked song is also available on SoundCloud. */
function videoLinkedSongHasSC(v: YouTubeCatalogVideo, songs: Map<string, SongCatalogItem>): boolean {
  const lid = (v.lyrics_id || '').trim()
  const song = lid ? songs.get(lid) : undefined
  if (!song) return false
  return songMatchesMediaCombo(song, 'lyrics_sc') || songMatchesMediaCombo(song, 'full')
}

function splitListTokens(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function instrumentTokensForVideo(video: YouTubeCatalogVideo): string[] {
  return splitListTokens(video.instruments || '')
}

function instrumentSummaryForVideo(video: YouTubeCatalogVideo, maxItems: number): string {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const token of instrumentTokensForVideo(video)) {
    const cleaned = token.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(cleaned)
    if (tokens.length >= maxItems) break
  }
  return tokens.join(', ')
}

function collectDistinctSorted(videos: YouTubeCatalogVideo[], getter: (v: YouTubeCatalogVideo) => string): string[] {
  const seen = new Set<string>()
  for (const v of videos) {
    const s = getter(v).trim()
    if (!s) continue
    seen.add(s)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

type VideoCardLinkTarget = 'all' | 'in_app' | 'off_site'

type VideosUrlFilters = {
  find: string
  sutra: string
  topic: string
  intention: string
  linkTarget: VideoCardLinkTarget
  media: VideoMediaFilter
  page: number
}

type VideoFacetChipKey = 'sutra' | 'topic' | 'intention'

function readLinkTarget(searchParams: URLSearchParams): VideoCardLinkTarget {
  const raw = (searchParams.get('link') ?? '').trim().toLowerCase()
  if (raw === 'in_app' || raw === 'song') return 'in_app'
  if (raw === 'off_site' || raw === 'youtube' || raw === 'external') return 'off_site'
  if (searchParams.get('catalog') === '1') return 'in_app'
  return 'all'
}

function readVideoMediaFilter(searchParams: URLSearchParams): VideoMediaFilter {
  const raw = (searchParams.get('media') ?? '').trim().toLowerCase()
  if (raw === 'has_sc') return 'has_sc'
  if (raw === 'any') return 'all'
  return 'all'
}

function readFiltersFromParams(searchParams: URLSearchParams): VideosUrlFilters {
  return {
    find: (searchParams.get('find') ?? '').trim(),
    sutra: (searchParams.get('sutra') ?? '').trim(),
    topic: (searchParams.get('topic') ?? '').trim(),
    intention: (searchParams.get('intention') ?? '').trim(),
    linkTarget: readLinkTarget(searchParams),
    media: readVideoMediaFilter(searchParams),
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1),
  }
}

function filtersToQueryString(f: VideosUrlFilters): string {
  const p = new URLSearchParams()
  if (f.find) p.set('find', f.find)
  if (f.sutra) p.set('sutra', f.sutra)
  if (f.topic) p.set('topic', f.topic)
  if (f.intention) p.set('intention', f.intention)
  if (f.linkTarget === 'in_app') p.set('link', 'in_app')
  else if (f.linkTarget === 'off_site') p.set('link', 'off_site')
  if (f.media && f.media !== 'all') p.set('media', f.media)
  if (f.page > 1) p.set('page', String(f.page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

function hrefVideos(partial: Partial<VideosUrlFilters>, base: VideosUrlFilters): string {
  const merged: VideosUrlFilters = { ...base, ...partial }
  const keys = Object.keys(partial) as (keyof VideosUrlFilters)[]
  if (keys.some((k) => k !== 'page')) merged.page = 1
  return browsePathWithQuery('/videos', filtersToQueryString(merged).replace(/^\?/, ''))
}

function isVerticalFormat(video: YouTubeCatalogVideo): boolean {
  const f = (video.format || '').trim().toLowerCase()
  return f.includes('9:16') || f.includes('vertical') || f === 'shorts'
}

function applyVideoFilters(
  videos: YouTubeCatalogVideo[],
  f: VideosUrlFilters,
  inAppIds: Set<string>,
  songsByLyricsId: Map<string, SongCatalogItem>,
): YouTubeCatalogVideo[] {
  let out = videos
  if (f.media === 'has_sc') {
    out = out.filter((v) => videoLinkedSongHasSC(v, songsByLyricsId))
  }
  if (f.linkTarget === 'in_app') {
    out = out.filter((v) => inAppIds.has(v.lyrics_id))
  } else if (f.linkTarget === 'off_site') {
    out = out.filter((v) => !inAppIds.has(v.lyrics_id))
  }
  if (f.sutra) {
    const s = f.sutra.toLowerCase()
    out = out.filter((v) => (v.sutra || '').trim().toLowerCase() === s)
  }
  if (f.topic) {
    out = out.filter((v) => (v.song_topic || '').trim() === f.topic)
  }
  if (f.intention) {
    out = out.filter((v) => (v.song_intention || '').trim() === f.intention)
  }
  if (f.find) {
    out = filterYoutubeVideosBySearchQuery(out, f.find)
  }
  return out
}

function countVideosWithSutra(videos: YouTubeCatalogVideo[], sutra: string): number {
  const s = sutra.toLowerCase()
  return videos.filter((v) => (v.sutra || '').trim().toLowerCase() === s).length
}

function countVideosWithTopic(videos: YouTubeCatalogVideo[], topic: string): number {
  return videos.filter((v) => (v.song_topic || '').trim() === topic).length
}

function countVideosWithIntention(videos: YouTubeCatalogVideo[], intention: string): number {
  return videos.filter((v) => (v.song_intention || '').trim() === intention).length
}

function VideoCardBody({
  v,
  songTitle,
  ytTitle,
  inApp,
  posterEager,
}: {
  v: YouTubeCatalogVideo
  songTitle: string
  ytTitle: string
  inApp: boolean
  posterEager: boolean
}) {
  const showUploadLine = Boolean(ytTitle && ytTitle !== songTitle)
  const instrumentSummary = instrumentSummaryForVideo(v, 2)
  const secondaryParts = [
    v.song_topic?.trim(),
    v.song_intention?.trim(),
    v.genre_primary?.trim(),
    instrumentSummary.trim() || '',
    v.duration?.trim(),
  ].filter(Boolean) as string[]
  const secondaryLine = secondaryParts.join(' · ')
  const sutraText = (v.sutra || '').trim()
  return (
    <>
      <div className="videos-page__card-media">
        {v.thumbnail_url ? (
          <img
            className="videos-page__card-thumb"
            src={coverImageUrl(v.thumbnail_url, { width: 640 })}
            alt=""
            width={640}
            height={360}
            loading={posterEager ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <span className="videos-page__card-thumb videos-page__card-thumb--fallback" aria-hidden>
            ▶
          </span>
        )}
        {!inApp ? (
          <span
            className="videos-page__card-destination-badge"
            aria-hidden
            title="Opens on YouTube, no in-app song page"
          >
            YouTube
          </span>
        ) : null}
      </div>
      <div className="videos-page__card-body">
        <span className="videos-page__card-song-title song-title">{songTitle}</span>
        {showUploadLine ? <span className="videos-page__card-upload-line">{ytTitle}</span> : null}
        <div className="catalog-card-meta videos-page__card-meta">
          {sutraText ? <span className={`catalog-sutra-word ${sutraClassName(sutraText)}`}>{sutraText}</span> : null}
          {secondaryLine ? (
            <span
              className="catalog-card-meta-secondary"
              title={secondaryLine}
              aria-label={`Tags: ${secondaryParts.join(', ')}`}
            >
              {secondaryLine}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function VideosPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const [youtubeCatalogVideos, setYoutubeCatalogVideos] = useState<YouTubeCatalogVideo[]>([])
  const [youtubeCatalogReady, setYoutubeCatalogReady] = useState(false)
  const [searchParams] = useSearchParams()
  const filters = useMemo(() => readFiltersFromParams(searchParams), [searchParams])
  const [findDraft, setFindDraft] = useState(filters.find)
  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep find draft aligned when `find` param changes externally
    setFindDraft(filters.find)
  }, [filters.find])

  useEffect(() => {
    if (findDraft === filters.find) return
    const tid = window.setTimeout(() => {
      navigate(hrefVideos({ find: findDraft.trim(), page: 1 }, filtersRef.current), { replace: true })
    }, FIND_DEBOUNCE_MS)
    return () => window.clearTimeout(tid)
  }, [findDraft, filters.find, navigate])
  // Keep server and client first paint aligned; avoid mobile hydration-open/close swaps that register as CLS.
  const [filtersOpen, setFiltersOpen] = useState(true)

  const inAppIds = useMemo(() => {
    const ids = songCatalogRows?.map((s) => (s.lyrics_id || '').trim()).filter(Boolean) ?? []
    return new Set(ids)
  }, [songCatalogRows])
  const songsByLyricsId = useMemo(() => buildSongMapByLyricsId(songCatalogRows ?? []), [songCatalogRows])

  const titleSuffix = [
    filters.linkTarget === 'off_site' ? 'YouTube-only' : filters.media === 'has_sc' ? '+ SoundCloud' : '',
    filters.sutra,
    filters.topic,
    filters.intention,
  ]
    .filter(Boolean)
    .join(' · ')
  const videosMetaTitle = titleSuffix ? `Music Videos · ${titleSuffix}` : 'Music Videos'
  const pageMeta = renderPageMeta({
    title: videosMetaTitle,
    description: 'BANANASUTRA music videos on YouTube. Browse by sutra, topic, and intention.',
    path: canonicalPathForRoute('/videos'),
  })

  useEffect(() => {
    let cancelled = false
    flattenYoutubeCatalogVideos()
      .then((rows) => {
        if (!cancelled) {
          setYoutubeCatalogVideos(Array.isArray(rows) ? rows : [])
          setYoutubeCatalogReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setYoutubeCatalogVideos([])
          setYoutubeCatalogReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const allVideos = useMemo(() => {
    const rows = youtubeCatalogVideos
    return [...rows].sort((a, b) => {
      const da = a.publish_date || ''
      const db = b.publish_date || ''
      if (da !== db) return db.localeCompare(da)
      return a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
    })
  }, [youtubeCatalogVideos])
  const orphanUploadCount = useMemo(
    () => allVideos.filter((v) => !inAppIds.has(v.lyrics_id)).length,
    [allVideos, inAppIds],
  )

  const hasSCCount = useMemo(
    () => allVideos.filter((v) => videoLinkedSongHasSC(v, songsByLyricsId)).length,
    [allVideos, songsByLyricsId],
  )

  useEffect(() => {
    if (searchParams.get('catalog') !== '1') return
    const p = new URLSearchParams(searchParams.toString())
    p.delete('catalog')
    if (!p.get('link')) p.set('link', 'in_app')
    const q = p.toString()
    navigate(browsePathWithQuery('/videos', q), { replace: true })
  }, [searchParams, navigate])

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    if (!p.has('genre') && !p.has('instrument') && !p.has('ctype')) return
    p.delete('genre')
    p.delete('instrument')
    p.delete('ctype')
    const q = p.toString()
    navigate(browsePathWithQuery('/videos', q), { replace: true })
  }, [searchParams, navigate])

  useEffect(() => {
    if (filters.linkTarget !== 'off_site') return
    if (orphanUploadCount > 0) return
    navigate(hrefVideos({ linkTarget: 'all' }, filters), { replace: true })
  }, [filters.linkTarget, orphanUploadCount, filters, navigate])

  const sutraOptions = useMemo(() => collectDistinctSorted(allVideos, (v) => v.sutra), [allVideos])
  const topicOptions = useMemo(() => collectDistinctSorted(allVideos, (v) => v.song_topic), [allVideos])
  const intentionOptions = useMemo(() => collectDistinctSorted(allVideos, (v) => v.song_intention), [allVideos])

  const shownVideos = useMemo(
    () => applyVideoFilters(allVideos, filters, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const featuredVideoHero = useMemo(() => {
    const filteredEmbeddable = shownVideos.filter((v) => Boolean(v.can_embed))
    if (filteredEmbeddable.length === 0) return null
    const featuredInFiltered = filteredEmbeddable.find((v) => Boolean(v.video_featured))
    return featuredInFiltered ?? filteredEmbeddable[0] ?? null
  }, [shownVideos])

  const featuredHeroSongPageHref = useMemo(() => {
    if (!featuredVideoHero) return null
    const id = (featuredVideoHero.lyrics_id || '').trim()
    return featuredYoutubeSongPageHref(featuredVideoHero, Boolean(id && inAppIds.has(id)))
  }, [featuredVideoHero, inAppIds])

  const hasActiveVideoFilters =
    Boolean(filters.find) ||
    Boolean(filters.sutra) ||
    Boolean(filters.topic) ||
    Boolean(filters.intention) ||
    filters.linkTarget !== 'all' ||
    filters.media !== 'all'

  const clearAllVideosFiltersHref = hrefVideos(
    {
      find: '',
      sutra: '',
      topic: '',
      intention: '',
      linkTarget: 'all',
      media: 'all',
      page: 1,
    },
    filters,
  )

  const verticalVideos = useMemo(() => shownVideos.filter(isVerticalFormat), [shownVideos])
  const wideOnlyVideos = useMemo(() => shownVideos.filter((v) => !isVerticalFormat(v)), [shownVideos])

  const pageCount = Math.max(1, Math.ceil(wideOnlyVideos.length / VIDEO_PAGE_SIZE))
  const urlVideoPage = filters.page
  const safeVideoPage = Math.min(urlVideoPage, pageCount)

  useEffect(() => {
    if (urlVideoPage === safeVideoPage) return
    navigate(hrefVideos({ page: safeVideoPage }, filters), { replace: true })
  }, [urlVideoPage, safeVideoPage, filters, navigate])

  const wideVideos = useMemo(
    () =>
      wideOnlyVideos.slice(
        (safeVideoPage - 1) * VIDEO_PAGE_SIZE,
        safeVideoPage * VIDEO_PAGE_SIZE,
      ),
    [wideOnlyVideos, safeVideoPage],
  )

  const wideTotal = wideOnlyVideos.length
  const showWidePager = wideTotal > VIDEO_PAGE_SIZE

  const videoPagerLink = useCallback(
    (target: number) => hrefVideos({ page: target }, filters),
    [filters],
  )

  useSyncCatalogHeaderHeight(pageRef, headerRef, [searchParams.toString(), filtersOpen, youtubeCatalogReady])

  if (catalogLoading || !youtubeCatalogReady) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell videos-page__loading-shell" id="main-content">
            <p className="about-page__p">Loading…</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (catalogError || songCatalogRows === null) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogError ?? 'Could not load song catalog data.'}</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  const chipSection = (
    id: string,
    heading: string,
    options: string[],
    paramKey: VideoFacetChipKey,
    current: string,
  ) => {
    if (!options.length) return null
    const total = allVideos.length
    return (
      <section className="catalog-facet" aria-labelledby={id}>
        <h3 id={id}>{heading}</h3>
        <div className="catalog-facet-chips" role="group" aria-labelledby={id}>
          <Link
            className={`catalog-facet-chip${!current ? ' is-active' : ''}`}
            to={hrefVideos({ [paramKey]: '' }, filters)}
            title={`${total} videos`}
          >
            <span>All</span>
            <span className="catalog-facet-count">{` (${total})`}</span>
          </Link>
          {options.map((opt) => {
            const active = current === opt
            const count =
              paramKey === 'sutra'
                ? countVideosWithSutra(allVideos, opt)
                : paramKey === 'topic'
                  ? countVideosWithTopic(allVideos, opt)
                  : countVideosWithIntention(allVideos, opt)
            return (
              <Link
                key={`${paramKey}-${opt}`}
                className={`catalog-facet-chip${active ? ' is-active' : ''}`}
                to={hrefVideos({ [paramKey]: active ? '' : opt }, filters)}
                title={paramKey === 'sutra' ? `${sutraQuestionFromDisplay(opt)} (${count} videos)` : `${count} videos`}
              >
                {paramKey === 'sutra' ? (
                  <span className={`catalog-facet-sutra-name ${sutraClassName(opt)}`}>{opt}</span>
                ) : (
                  <span>{opt}</span>
                )}
                <span className="catalog-facet-count">{` (${count})`}</span>
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  const renderCard = (v: YouTubeCatalogVideo, layout: 'rail' | 'grid', posterIndex: number) => {
    const posterEager = posterIndex < 3
    const songTitle = (v.lyrics_title || '').trim() || v.title || 'Song'
    const ytTitle = (v.title || '').trim()
    const lid = (v.lyrics_id || '').trim()
    const cat = lid ? songsByLyricsId.get(lid) : undefined
    const songHref = songCatalogLinkTo(songTitle, v.url_slug || cat?.url_slug, { section: 'video' })
    const inApp = inAppIds.has((v.lyrics_id || '').trim())
    const liClass = layout === 'rail' ? 'videos-page__rail-cell' : 'videos-page__grid-cell'

    if (inApp) {
      return (
        <li key={v.video_id} className={liClass}>
          <Link
            className={`videos-page__card videos-page__card--in-app${layout === 'rail' ? ' videos-page__card--rail' : ''}`}
            to={songHref}
            aria-label={`${songTitle}. ${ytTitle && ytTitle !== songTitle ? ytTitle : 'Video'}`}
          >
            <VideoCardBody v={v} songTitle={songTitle} ytTitle={ytTitle} inApp posterEager={posterEager} />
          </Link>
        </li>
      )
    }

    return (
      <li key={v.video_id} className={liClass}>
        <a
          className={`videos-page__card videos-page__card--external${layout === 'rail' ? ' videos-page__card--rail' : ''}`}
          href={v.yt_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Watch on YouTube (no in-app song page): ${songTitle}`}
        >
          <VideoCardBody v={v} songTitle={songTitle} ytTitle={ytTitle} inApp={false} posterEager={posterEager} />
        </a>
      </li>
    )
  }

  const videoContextSummary = hasActiveVideoFilters
    ? `${shownVideos.length} of ${allVideos.length} videos`
    : `${allVideos.length} videos`

  const videoActiveFilterContext = (
    <section
      className="catalog-active-context"
      aria-label={hasActiveVideoFilters ? 'Active filters and result count' : 'Videos result count'}
    >
      <p className="catalog-active-context__summary">{videoContextSummary}</p>
      {hasActiveVideoFilters ? (
        <div className="catalog-chips">
          {filters.find ? (
            <Link
              to={hrefVideos({ find: '' }, filters)}
              className="catalog-chip catalog-chip--find"
              title="Remove text filter"
            >
              Discovery: {filters.find}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.media === 'has_sc' ? (
            <Link
              to={hrefVideos({ media: 'all', linkTarget: 'all' }, filters)}
              className="catalog-chip"
              title="Clear media filter"
            >
              + SoundCloud
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.linkTarget === 'off_site' ? (
            <Link
              to={hrefVideos({ linkTarget: 'all' }, filters)}
              className="catalog-chip"
              title="Show all videos"
            >
              YouTube-only
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.sutra ? (
            <Link
              to={hrefVideos({ sutra: '' }, filters)}
              className="catalog-chip"
              title={`Remove sutra filter · ${sutraQuestionFromDisplay(filters.sutra)}`}
            >
              Sutra:{' '}
              <span className={`catalog-facet-sutra-name ${sutraClassName(filters.sutra)}`}>{filters.sutra}</span>
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.topic ? (
            <Link to={hrefVideos({ topic: '' }, filters)} className="catalog-chip" title="Remove topic filter">
              Topic: {filters.topic}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          {filters.intention ? (
            <Link
              to={hrefVideos({ intention: '' }, filters)}
              className="catalog-chip"
              title="Remove intention filter"
            >
              Intention: {filters.intention}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </Link>
          ) : null}
          <Link to={clearAllVideosFiltersHref} className="catalog-clear">
            Clear all
          </Link>
        </div>
      ) : null}
    </section>
  )

  let nextPosterIndex = 0

  const listSection = (
    <section className="videos-page__list-wrap" aria-label="Video list">
      {shownVideos.length === 0 ? (
        <p className="videos-page__empty">No videos match these filters.</p>
      ) : (
        <>
          {verticalVideos.length > 0 ? (
            <div className="videos-page__rail-section">
              <h2 className="videos-page__rail-heading catalog-section-title">Music reels</h2>
              <ScrollRail className="videos-page__rail-scroll">
                <ul className="videos-page__rail">
                  {verticalVideos.map((v) => renderCard(v, 'rail', nextPosterIndex++))}
                </ul>
              </ScrollRail>
            </div>
          ) : null}
          {wideVideos.length > 0 ? (
            <>
              {showWidePager ? (
                <CatalogPager
                  variant="top"
                  safePage={safeVideoPage}
                  pageCount={pageCount}
                  totalInView={wideTotal}
                  pageSize={VIDEO_PAGE_SIZE}
                  pagerLink={videoPagerLink}
                />
              ) : null}
              <div className="videos-page__grid-section">
                {verticalVideos.length > 0 ? (
                  <h2 className="videos-page__rail-heading videos-page__rail-heading--spaced catalog-section-title">
                    Music videos
                  </h2>
                ) : null}
                <ul className="videos-page__grid">
                  {wideVideos.map((v) => renderCard(v, 'grid', nextPosterIndex++))}
                </ul>
              </div>
              {showWidePager ? (
                <CatalogPager
                  variant="bottom"
                  safePage={safeVideoPage}
                  pageCount={pageCount}
                  totalInView={wideTotal}
                  pageSize={VIDEO_PAGE_SIZE}
                  pagerLink={videoPagerLink}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
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
          <span className="catalog-breadcrumbs__current" aria-current="page">Videos</span>
        </nav>

        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">Picture the Songs</h1>
          <p className="catalog-page-sub">
            Same songs, eyes open. Tall reels and wide frames, side by side. Some of these live only on YouTube with
            no SoundCloud twin. That&apos;s by design, not an oversight.
          </p>
        </div>

        <div className={`catalog-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
          <aside
            className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
            aria-labelledby="videos-filters-heading"
          >
            <div className="catalog-filters-head">
              <h2 id="videos-filters-heading" className="catalog-section-title">
                Filters
              </h2>
              <button
                type="button"
                className="catalog-icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-expanded={filtersOpen}
                aria-controls="videos-filter-panel"
              >
                Hide
              </button>
            </div>

            {filtersOpen ? videoActiveFilterContext : null}

            <div id="videos-filter-panel" className="catalog-facet-stack">
              <section className="catalog-facet" aria-labelledby="videos-search-heading">
                <h3 id="videos-search-heading">Search</h3>
                <label className="catalog-facet-find-label" htmlFor="videos-find-input">
                  Search by title or catalog info
                </label>
                <input
                  id="videos-find-input"
                  className="catalog-facet-find-input"
                  type="search"
                  name="videos_find"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  value={findDraft}
                  onChange={(e) => setFindDraft(e.target.value)}
                />
              </section>
              <section className="catalog-facet" aria-labelledby="videos-media-heading">
                <h3 id="videos-media-heading">Media</h3>
                <p className="catalog-facet-help" id="videos-media-desc">
                  Some videos also have SoundCloud playback or full lyrics—filter by what&apos;s available.
                </p>
                <div className="catalog-facet-chips" role="group" aria-describedby="videos-media-desc">
                  <Link
                    className={`catalog-facet-chip${filters.media === 'all' && filters.linkTarget !== 'off_site' ? ' is-active' : ''}`}
                    to={hrefVideos({ media: 'all', linkTarget: 'all' }, filters)}
                    title={`All ${allVideos.length} videos`}
                  >
                    <span>All</span>
                    <span className="catalog-facet-count">{` (${allVideos.length})`}</span>
                  </Link>
                  <Link
                    className={`catalog-facet-chip${filters.media === 'has_sc' ? ' is-active' : ''}`}
                    to={hrefVideos({ media: 'has_sc', linkTarget: 'all' }, filters)}
                    title={`${hasSCCount} videos with linked song on SoundCloud`}
                  >
                    <span>+ SoundCloud</span>
                    <span className="catalog-facet-count">{` (${hasSCCount})`}</span>
                  </Link>
                  {orphanUploadCount > 0 ? (
                    <Link
                      className={`catalog-facet-chip${filters.linkTarget === 'off_site' ? ' is-active' : ''}`}
                      to={hrefVideos({ linkTarget: 'off_site', media: 'all' }, filters)}
                      title={`${orphanUploadCount} videos with no linked song page`}
                    >
                      <span>YouTube-only</span>
                      <span className="catalog-facet-count">{` (${orphanUploadCount})`}</span>
                    </Link>
                  ) : null}
                </div>
              </section>

              {chipSection('videos-sutra-heading', 'Sutra', sutraOptions, 'sutra', filters.sutra)}
              {chipSection('videos-topic-heading', 'Topic', topicOptions, 'topic', filters.topic)}
              {chipSection('videos-intention-heading', 'Intention', intentionOptions, 'intention', filters.intention)}

            </div>
          </aside>

          <main id="main-content" className="catalog-main">
            {!filtersOpen ? (
              <>
                {videoActiveFilterContext}
                <button
                  type="button"
                  className="catalog-filter-reopen"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={false}
                  aria-controls="videos-filter-panel"
                >
                  Show filters
                </button>
              </>
            ) : null}
            {featuredVideoHero ? (
              <section className="videos-page__featured-hero" aria-labelledby="videos-featured-hero-heading">
                <h2 id="videos-featured-hero-heading" className="catalog-section-title">
                  Featured Video
                </h2>
                <div className="videos-page__featured-hero-grid">
                  <div className="videos-page__featured-hero-embed-wrap">
                    <YoutubeEmbeddedPlayer
                      videoId={featuredVideoHero.video_id}
                      title={featuredVideoHero.lyrics_title || featuredVideoHero.title || 'Featured video'}
                      embedWrapperClassName="videos-page__featured-hero-embed"
                      embedWrapperStyle={{ aspectRatio: youtubeAspectRatioFromFormat(featuredVideoHero.format) }}
                      iframeClassName="videos-page__featured-hero-iframe"
                      facadeUntilClick
                      facadePosterEager
                      posterWidth={640}
                      outboundFooterClassName="videos-page__featured-hero-yt-outbound"
                    />
                  </div>
                  <div className="videos-page__featured-hero-copy">
                    <h3 className="videos-page__featured-hero-title">{featuredVideoHero.lyrics_title || featuredVideoHero.title}</h3>
                    {(featuredVideoHero.lyrics_summary || '').trim() ? (
                      <p className="videos-page__featured-hero-summary">{featuredVideoHero.lyrics_summary?.trim()}</p>
                    ) : null}
                    {(featuredVideoHero.sutra || '').trim() ? (
                      <p className="videos-page__featured-hero-sutra">{featuredVideoHero.sutra.trim()}</p>
                    ) : null}
                    {featuredHeroSongPageHref ? (
                      <div className="catalog-featured-video-song-row">
                        <Link className="catalog-song-page-cta" to={featuredHeroSongPageHref}>
                          Song page
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            {listSection}
          </main>
        </div>
      </div>
      <GlobalFooter />
    </div>
  )
}
