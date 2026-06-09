import { Link } from 'react-router-dom'
import { SUTRA_CONTEXT, sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'

const SUTRA_GRID_KEYS: readonly SutraFamilyKey[] = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK']

/** Stage sutra tile grid — question + practice, color-coded (pre–W-064 cardEssence cards). */
export function HomePortalSutraGrid() {
  return (
    <div className="home-portal__sutra-grid">
      {SUTRA_GRID_KEYS.map((key) => {
        const ctx = SUTRA_CONTEXT[key]
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
            </div>
          </Link>
        )
      })}
    </div>
  )
}
