import { Link } from 'react-router-dom'
import { SUTRA_CONTEXT, sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'
import { formatHomeCount } from './homePortalData'

const SUTRA_GRID_KEYS: readonly SutraFamilyKey[] = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK']

type Props = {
  songCounts: ReadonlyMap<SutraFamilyKey, number>
}

/** Sutra tile grid — question, practice, live song count. */
export function HomePortalSutraGrid({ songCounts }: Props) {
  return (
    <div className="home-portal__sutra-grid">
      {SUTRA_GRID_KEYS.map((key) => {
        const ctx = SUTRA_CONTEXT[key]
        const count = songCounts.get(key) ?? 0
        const countLabel = count === 1 ? '1 song' : `${formatHomeCount(count)} songs`
        return (
          <Link
            key={key}
            className={`home-portal__sutra-tile home-portal__sutra-tile--${key.toLowerCase()}`.trim()}
            to={sutraHrefForFamily(key)}
          >
            <div className="home-portal__sutra-tile-top">
              <span className="home-portal__sutra-tile-name">{ctx.sutra}</span>
              <span className="home-portal__sutra-tile-question">{ctx.question}</span>
              <span className="home-portal__sutra-tile-practice">
                {key === 'QUACK' ? 'Sub of BLOW' : ctx.practice}
              </span>
              <span className="home-portal__sutra-tile-count">{countLabel}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
