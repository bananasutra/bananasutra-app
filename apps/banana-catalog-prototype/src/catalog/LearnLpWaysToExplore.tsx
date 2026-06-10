import { Link } from 'react-router-dom'
import buildSummaryJson from '../data/generated/_build_summary.json'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import { canonicalPathForRoute } from './seoPaths'
import { CATALOG_BROWSE_PATH } from './urlState'
import { songOnWordsSurface } from './wordsStory'
import type { SongCatalogItem } from './types'
import { ScrollRevealSection } from './ScrollRevealSection'
import './LearnLpWaysToExplore.css'

function buildSummaryCount(key: string): number {
  const v = (buildSummaryJson as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : 0
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

const HOME_BROWSE_CATALOG = songCatalogBrowseJson as SongCatalogItem[]

function songHasReleasedListenerAudio(s: SongCatalogItem): boolean {
  return Boolean(s.has_in_app_playback || s.has_sc_catalog_listen || (s.primary_ep_url || '').trim())
}

function songHasReleasedVideo(s: SongCatalogItem): boolean {
  return Boolean(s.has_youtube_video)
}

export function LearnLpWaysToExplore() {
  const searchDiscoverRowCount = HOME_BROWSE_CATALOG.length
  const songsBrowseGridCount = HOME_BROWSE_CATALOG.filter(
    (s) => songHasReleasedListenerAudio(s) || songHasReleasedVideo(s),
  ).length
  const wordsSurfaceCount = HOME_BROWSE_CATALOG.filter((s) => songOnWordsSurface(s)).length

  return (
    <ScrollRevealSection immediate className="learn-lp__explore" aria-labelledby="learn-lp-explore-heading">
      <h2 id="learn-lp-explore-heading" className="catalog-section-title">
        Ways to explore
      </h2>
      <p className="catalog-lp-section-intro">
        Same catalog, different doors. Search, browse, listen, watch, or read lyrics-only pieces.
      </p>
      <ul className="about-page__how-grid learn-lp__explore-grid">
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={`${CATALOG_BROWSE_PATH}#catalog-songs-find-input`}>
            <span className="about-page__how-label">Search &amp; discover →</span>
            <span className="about-page__how-stat">
              {`${formatCount(searchDiscoverRowCount)} songs & lyrics · find + filters`}
            </span>
            <span className="about-page__how-desc">
              Find any song by title, sutra, muse, topic, or vibe. Start typing, start finding.
            </span>
          </Link>
        </li>
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={canonicalPathForRoute('/songbooks')}>
            <span className="about-page__how-label">Browse songbooks →</span>
            <span className="about-page__how-stat">{formatCount(buildSummaryCount('songbooks'))} curated collections</span>
            <span className="about-page__how-desc">
              Best-of SoundCloud playlists that tell a story. By topic, by genres, and by language.
            </span>
          </Link>
        </li>
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={CATALOG_BROWSE_PATH}>
            <span className="about-page__how-label">Explore the fool catalog →</span>
            <span className="about-page__how-stat">
              {`${formatCount(songsBrowseGridCount)} songs · meaning-first`}
            </span>
            <span className="about-page__how-desc">
              Every song in one place. Filter, wander, or let something find you.
            </span>
          </Link>
        </li>
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={canonicalPathForRoute('/tracks')}>
            <span className="about-page__how-label">Listen to top tracks →</span>
            <span className="about-page__how-stat">
              {formatCount(buildSummaryCount('track_catalog_rows'))} tracks · sound-first
            </span>
            <span className="about-page__how-desc">
              The best tracks, ranked and filterable by tempo, genres, instruments, and moods.
            </span>
          </Link>
        </li>
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={canonicalPathForRoute('/videos')}>
            <span className="about-page__how-label">Watch music videos →</span>
            <span className="about-page__how-stat">
              {formatCount(buildSummaryCount('youtube_video_rows'))} videos · eyes first
            </span>
            <span className="about-page__how-desc">
              The visual YouTube wall. Same songs, eye candy style.
            </span>
          </Link>
        </li>
        <li className="about-page__how-cell">
          <Link className="about-page__how-card" to={canonicalPathForRoute('/words')}>
            <span className="about-page__how-label">Read the words →</span>
            <span className="about-page__how-stat">
              {formatCount(wordsSurfaceCount)} lyrics-first songs
            </span>
            <span className="about-page__how-desc">
              Lyrics without music. Pieces still brewing, or that live as text alone.
            </span>
          </Link>
        </li>
      </ul>
    </ScrollRevealSection>
  )
}
