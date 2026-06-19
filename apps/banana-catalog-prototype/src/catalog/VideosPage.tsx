import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { reportVideosFilterTransition } from './catalogAnalytics'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarChipOption,
  type CatalogFilterBarFacetGroup,
  type CatalogFilterBarSecondaryGroup,
} from './CatalogFilterBar'
import { flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { songCatalogLinkTo } from './songPaths'
import { sutraClassName, sutraFilterChipClassName } from './sutraTheme'
import { sortSutraDisplayNames, sutraQuestionFromDisplay } from './sutraContext'
import type { SongCatalogItem, YouTubeCatalogVideo } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import {
  applyVideoFilters,
  hrefVideos,
  readVideosFiltersFromParams,
  videoLinkedSongHasSC,
  type VideosUrlFilters,
} from './videosFiltersCore'
import { coverImageUrl } from '../seo/imageUrl'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { ScrollRail } from './ScrollRail'
import { CatalogInfiniteScrollFooter } from './CatalogInfiniteScrollFooter'
import {
  catalogInfiniteScrollStorageKey,
  useCatalogInfiniteScroll,
} from './useCatalogInfiniteScroll'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
import { featuredYoutubeSongPageHref } from './featuredYoutubeSongPageHref'
import './CatalogApp.css'
import './VideosPage.css'
import { useSongCatalog } from './generatedData'

const FIND_DEBOUNCE_MS = 350
const REELS_RAIL_SCROLL_STEP = 164

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

function buildSongMapByLyricsId(songCatalog: SongCatalogItem[]): Map<string, SongCatalogItem> {
  const m = new Map<string, SongCatalogItem>()
  for (const s of songCatalog) {
    const id = (s.lyrics_id || '').trim()
    if (id) m.set(id, s)
  }
  return m
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

type VideoFacetChipKey = 'sutra' | 'topic' | 'intention'

function isVerticalFormat(video: YouTubeCatalogVideo): boolean {
  const f = (video.format || '').trim().toLowerCase()
  return f.includes('9:16') || f.includes('vertical') || f === 'shorts'
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
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
  const filters = useMemo(() => readVideosFiltersFromParams(searchParams), [searchParams])
  const [legacyPageSeed] = useState(() => filters.page)
  const [findDraft, setFindDraft] = useState(filters.find)
  const filtersRef = useRef(filters)
  const prevVideoFiltersRef = useRef<VideosUrlFilters | null>(null)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    const prev = prevVideoFiltersRef.current
    if (prev) {
      reportVideosFilterTransition(
        {
          sutra: prev.sutra,
          topic: prev.topic,
          intention: prev.intention,
          media: prev.media,
          linkTarget: prev.linkTarget,
        },
        {
          sutra: filters.sutra,
          topic: filters.topic,
          intention: filters.intention,
          media: filters.media,
          linkTarget: filters.linkTarget,
        },
      )
    }
    prevVideoFiltersRef.current = filters
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
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)
  const visitSeedRef = useRef(Math.floor(Math.random() * 1_000_000_000))

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

  useEffect(() => {
    if (filters.page <= 1) return
    navigate(hrefVideos({ page: 1 }, filters), { replace: true })
  }, [filters.page, filters, navigate])

  const sutraOptions = useMemo(
    () => sortSutraDisplayNames(collectDistinctSorted(allVideos, (v) => v.sutra)),
    [allVideos],
  )
  const topicOptions = useMemo(() => collectDistinctSorted(allVideos, (v) => v.song_topic), [allVideos])
  const intentionOptions = useMemo(() => collectDistinctSorted(allVideos, (v) => v.song_intention), [allVideos])

  const shownVideos = useMemo(
    () => applyVideoFilters(allVideos, filters, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const contextualRowsWithoutSutra = useMemo(
    () => applyVideoFilters(allVideos, { ...filters, sutra: '', page: 1 }, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const contextualRowsWithoutTopic = useMemo(
    () => applyVideoFilters(allVideos, { ...filters, topic: '', page: 1 }, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const contextualRowsWithoutIntention = useMemo(
    () => applyVideoFilters(allVideos, { ...filters, intention: '', page: 1 }, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const contextualRowsWithoutMediaLink = useMemo(
    () => applyVideoFilters(allVideos, { ...filters, media: 'all', linkTarget: 'all', page: 1 }, inAppIds, songsByLyricsId),
    [allVideos, filters, inAppIds, songsByLyricsId],
  )
  const hasActiveVideoFilters =
    Boolean(filters.find) ||
    Boolean(filters.sutra) ||
    Boolean(filters.topic) ||
    Boolean(filters.intention) ||
    filters.linkTarget !== 'all' ||
    filters.media !== 'all'
  const featuredVideoHero = useMemo(() => {
    const featuredPool = shownVideos.filter((v) => Boolean(v.can_embed) && Boolean(v.video_featured))
    if (featuredPool.length === 0) return null
    const baseSeed = String(visitSeedRef.current)
    const filterSeed = hasActiveVideoFilters
      ? `${filters.find}|${filters.sutra}|${filters.topic}|${filters.intention}|${filters.media}|${filters.linkTarget}`
      : '__all__'
    const pickIdx = hashString(`${baseSeed}|${filterSeed}`) % featuredPool.length
    return featuredPool[pickIdx] ?? null
  }, [shownVideos, hasActiveVideoFilters, filters])

  const featuredHeroSongPageHref = useMemo(() => {
    if (!featuredVideoHero) return null
    const id = (featuredVideoHero.lyrics_id || '').trim()
    return featuredYoutubeSongPageHref(featuredVideoHero, Boolean(id && inAppIds.has(id)))
  }, [featuredVideoHero, inAppIds])

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

  const videosScrollResetKey = useMemo(
    () =>
      [
        filters.find,
        filters.sutra,
        filters.topic,
        filters.intention,
        filters.media,
        filters.linkTarget,
      ].join('|'),
    [filters.find, filters.sutra, filters.topic, filters.intention, filters.media, filters.linkTarget],
  )

  const {
    visibleItems: wideVideos,
    visibleCount: wideVisibleCount,
    totalCount: wideTotal,
    hasMore: wideHasMore,
    loadMore: loadMoreWideVideos,
  } = useCatalogInfiniteScroll({
    items: wideOnlyVideos,
    resetKey: videosScrollResetKey,
    storageKey: catalogInfiniteScrollStorageKey('/videos', videosScrollResetKey),
    legacyPage: legacyPageSeed,
  })

  useSyncCatalogHeaderHeight(pageRef, headerRef, [searchParams.toString(), filterBarExpanded])

  if (!catalogLoading && (catalogError || songCatalogRows === null)) {
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

  const buildVideoFacetGroup = (
    id: string,
    label: string,
    options: string[],
    paramKey: VideoFacetChipKey,
    current: string,
    contextualRows: YouTubeCatalogVideo[],
  ): CatalogFilterBarFacetGroup | null => {
    if (!options.length) return null
    const chipOptions: CatalogFilterBarChipOption[] = options.map((opt) => {
      const active = current === opt
      const count = contextualRows.filter((video) =>
        paramKey === 'sutra'
          ? (video.sutra || '').trim().toLowerCase() === opt.toLowerCase()
          : paramKey === 'topic'
            ? (video.song_topic || '').trim() === opt
            : (video.song_intention || '').trim() === opt,
      ).length
      return {
        id: `${paramKey}-${opt}`,
        label:
          paramKey === 'sutra' ? (
            <span className={`catalog-facet-sutra-name ${sutraClassName(opt)}`}>{opt}</span>
          ) : (
            opt
          ),
        href: hrefVideos({ [paramKey]: active ? '' : opt }, filters),
        count,
        active,
        disabled: !active && count === 0,
        className: paramKey === 'sutra' ? sutraFilterChipClassName(opt) : undefined,
        title: paramKey === 'sutra' ? `${sutraQuestionFromDisplay(opt)} (${count} videos)` : `${count} videos`,
      }
    })
    return {
      id,
      label,
      allHref: hrefVideos({ [paramKey]: '' }, filters),
      allCount: contextualRows.length,
      options: chipOptions,
    }
  }

  const videoContextSummary = hasActiveVideoFilters
    ? `${shownVideos.length} of ${allVideos.length} videos`
    : `${allVideos.length} videos`

  const videoActivePills: CatalogFilterBarActivePill[] = []
  if (filters.find) {
    videoActivePills.push({
      id: 'find',
      label: <>Search: {filters.find}</>,
      href: hrefVideos({ find: '' }, filters),
      title: 'Remove text filter',
      className: 'catalog-filter-bar__pill--find',
    })
  }
  if (filters.media === 'has_sc') {
    videoActivePills.push({
      id: 'media-sc',
      label: '+ SoundCloud',
      href: hrefVideos({ media: 'all', linkTarget: 'all' }, filters),
      title: 'Clear media filter',
    })
  }
  if (filters.linkTarget === 'off_site') {
    videoActivePills.push({
      id: 'link-off-site',
      label: 'YouTube-only',
      href: hrefVideos({ linkTarget: 'all' }, filters),
      title: 'Show all videos',
    })
  }
  if (filters.sutra) {
    videoActivePills.push({
      id: 'sutra',
      label: (
        <>
          Sutra:{' '}
          <span className={`catalog-facet-sutra-name ${sutraClassName(filters.sutra)}`}>{filters.sutra}</span>
        </>
      ),
      href: hrefVideos({ sutra: '' }, filters),
      title: `Remove sutra filter · ${sutraQuestionFromDisplay(filters.sutra)}`,
    })
  }
  if (filters.topic) {
    videoActivePills.push({
      id: 'topic',
      label: <>Topic: {filters.topic}</>,
      href: hrefVideos({ topic: '' }, filters),
      title: 'Remove topic filter',
    })
  }
  if (filters.intention) {
    videoActivePills.push({
      id: 'intention',
      label: <>Intention: {filters.intention}</>,
      href: hrefVideos({ intention: '' }, filters),
      title: 'Remove intention filter',
    })
  }

  const mediaAllCount = contextualRowsWithoutMediaLink.length
  const mediaHasScCount = contextualRowsWithoutMediaLink.filter((video) =>
    videoLinkedSongHasSC(video, songsByLyricsId),
  ).length
  const mediaYoutubeOnlyCount = contextualRowsWithoutMediaLink.filter(
    (video) => !inAppIds.has((video.lyrics_id || '').trim()),
  ).length
  const mediaAllActive = filters.media === 'all' && filters.linkTarget !== 'off_site'
  const mediaHasScActive = filters.media === 'has_sc'
  const mediaOffSiteActive = filters.linkTarget === 'off_site'
  const disableMediaHasSc = !mediaHasScActive && mediaHasScCount === 0
  const disableMediaOffSite = !mediaOffSiteActive && mediaYoutubeOnlyCount === 0

  const videoSecondaryGroup: CatalogFilterBarSecondaryGroup = {
    id: 'media',
    label: 'Media',
    helpText: "Some videos also have SoundCloud playback or full lyrics. Filter by what's available.",
    options: [
      {
        id: 'media-all',
        label: 'All',
        href: hrefVideos({ media: 'all', linkTarget: 'all' }, filters),
        count: mediaAllCount,
        active: mediaAllActive,
        title: `All ${mediaAllCount} videos`,
      },
      {
        id: 'media-has-sc',
        label: '+ SoundCloud',
        href: hrefVideos({ media: 'has_sc', linkTarget: 'all' }, filters),
        count: mediaHasScCount,
        active: mediaHasScActive,
        disabled: disableMediaHasSc,
        title: `${mediaHasScCount} videos with linked song on SoundCloud`,
      },
      {
        id: 'media-off-site',
        label: 'YouTube-only',
        href: hrefVideos({ linkTarget: 'off_site', media: 'all' }, filters),
        count: mediaYoutubeOnlyCount,
        active: mediaOffSiteActive,
        disabled: disableMediaOffSite,
        title: `${mediaYoutubeOnlyCount} videos with no linked song page`,
      },
    ],
  }

  const videoFacetGroups = [
    buildVideoFacetGroup('sutra', 'Sutra', sutraOptions, 'sutra', filters.sutra, contextualRowsWithoutSutra),
    buildVideoFacetGroup('topic', 'Topic', topicOptions, 'topic', filters.topic, contextualRowsWithoutTopic),
    buildVideoFacetGroup(
      'intention',
      'Intention',
      intentionOptions,
      'intention',
      filters.intention,
      contextualRowsWithoutIntention,
    ),
  ].filter((group): group is CatalogFilterBarFacetGroup => group !== null)

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

  let nextPosterIndex = 0

  const videosResultCountLine =
    shownVideos.length === 0
      ? hasActiveVideoFilters
        ? 'No videos match these filters.'
        : ''
      : hasActiveVideoFilters
        ? `Showing ${formatCount(shownVideos.length)} of ${formatCount(allVideos.length)} videos`
        : `${formatCount(allVideos.length)} videos`

  const listSection = (
    <section className="videos-page__list-wrap" aria-label="Video list">
      {!youtubeCatalogReady ? (
        <p className="videos-page__empty" aria-live="polite">
          Loading videos…
        </p>
      ) : shownVideos.length === 0 ? (
        <p className="videos-page__empty">No videos match these filters.</p>
      ) : (
        <>
          {videosResultCountLine ? (
            <p className="videos-page__result-count about-result-count" aria-live="polite">
              {videosResultCountLine}
            </p>
          ) : null}
          {verticalVideos.length > 0 ? (
            <div className="videos-page__rail-section">
              <h2 className="videos-page__section-heading catalog-section-title">
                Music reels{' '}
                <span className="videos-page__section-count">({formatCount(verticalVideos.length)})</span>
              </h2>
              <p className="catalog-lp-section-intro">Vertical clips. Swipe sideways through the tall ones.</p>
              <ScrollRail
                className="videos-page__rail-scroll listen-lp__scroll-rail"
                variant="fade"
                scrollStep={REELS_RAIL_SCROLL_STEP}
              >
                <ul className="videos-page__rail">
                  {verticalVideos.map((v) => renderCard(v, 'rail', nextPosterIndex++))}
                </ul>
              </ScrollRail>
            </div>
          ) : null}
          {wideVideos.length > 0 ? (
            <div className="videos-page__grid-section">
              <h2
                className={`videos-page__section-heading catalog-section-title${
                  verticalVideos.length > 0 ? ' videos-page__section-heading--spaced' : ''
                }`}
              >
                Music videos <span className="videos-page__section-count">({formatCount(wideTotal)})</span>
              </h2>
              <p className="catalog-lp-section-intro">Wide format uploads. Tap a card for the song page or YouTube.</p>
              <ul className="videos-page__grid">
                {wideVideos.map((v) => renderCard(v, 'grid', nextPosterIndex++))}
              </ul>
              <CatalogInfiniteScrollFooter
                visibleCount={wideVisibleCount}
                totalCount={wideTotal}
                hasMore={wideHasMore}
                loadMore={loadMoreWideVideos}
                noun="music videos"
                formatCount={formatCount}
              />
            </div>
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

        <div className="videos-page__content">
          <CatalogFilterBar
            ariaLabel="Filter videos"
            panelId="videos-filter-panel"
            resultSummary={videoContextSummary}
            showResultSummary={false}
            activePills={videoActivePills}
            clearAllHref={clearAllVideosFiltersHref}
            facetGroups={videoFacetGroups}
            secondaryGroup={videoSecondaryGroup}
            search={{
              id: 'videos-find-input',
              label: 'Search',
              ariaLabel: 'Search videos by title or catalog info',
              value: findDraft,
              onChange: setFindDraft,
              inputName: 'videos_find',
            }}
            defaultExpanded={filterBarExpanded}
            onExpandedChange={setFilterBarExpanded}
          />

          <main id="main-content" className="catalog-main videos-page__main">
            {!youtubeCatalogReady || featuredVideoHero ? (
              <section
                className={`videos-page__featured-hero${!youtubeCatalogReady ? ' videos-page__featured-hero--pending' : ''}`}
                aria-labelledby="videos-featured-hero-heading"
                aria-busy={!youtubeCatalogReady}
              >
                <h2 id="videos-featured-hero-heading" className="catalog-section-title">
                  Featured video
                </h2>
                {!youtubeCatalogReady ? (
                  <div className="videos-page__featured-hero-grid" aria-hidden="true">
                    <div className="videos-page__featured-hero-skeleton-embed" />
                    <div className="videos-page__featured-hero-skeleton-copy">
                      <span className="videos-page__featured-hero-skeleton-line videos-page__featured-hero-skeleton-line--title" />
                      <span className="videos-page__featured-hero-skeleton-line" />
                      <span className="videos-page__featured-hero-skeleton-line videos-page__featured-hero-skeleton-line--short" />
                    </div>
                  </div>
                ) : featuredVideoHero ? (
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
                        showOutboundFooter={false}
                      />
                    </div>
                    <div className="catalog-featured-embed-copy videos-page__featured-hero-copy">
                      <p className="catalog-featured-embed-copy__title">
                        {featuredVideoHero.lyrics_title || featuredVideoHero.title}
                      </p>
                      {(featuredVideoHero.sutra || '').trim() ? (
                        <p className="catalog-featured-embed-copy__meta">{featuredVideoHero.sutra.trim()}</p>
                      ) : null}
                      {(featuredVideoHero.lyrics_summary || '').trim() ? (
                        <p className="catalog-featured-embed-copy__desc">{featuredVideoHero.lyrics_summary?.trim()}</p>
                      ) : null}
                      {featuredHeroSongPageHref ? (
                        <Link className="catalog-featured-embed-copy__cta" to={featuredHeroSongPageHref}>
                          Song page →
                        </Link>
                      ) : null}
                      {(featuredVideoHero.yt_url || '').trim() ? (
                        <CatalogMediaOutbound href={featuredVideoHero.yt_url.trim()} />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
            {listSection}
            {youtubeCatalogReady && shownVideos.length > 0 ? (
              <Link
                className="catalog-section-cta videos-page__watch-crosslink"
                to={`${canonicalPathForRoute('/watch')}#watch-lp-playlists-heading`}
              >
                Watch playlists →
              </Link>
            ) : null}
          </main>
        </div>
      </div>
      <GlobalFooter />
    </div>
  )
}
