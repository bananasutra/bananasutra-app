import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { logNotFound } from './notFoundLogger'
import { buildNotFoundOpenEventDetail } from '../bbb/notFoundRouting'

export type NotFoundRouteProps = {
  onLogNotFound?: (input: { badPath: string; referrer?: string }) => Promise<void> | void
}

export function NotFoundRoute({ onLogNotFound = logNotFound }: NotFoundRouteProps) {
  const location = useLocation()
  const badPath = location.pathname || '/'

  useEffect(() => {
    void onLogNotFound({
      badPath,
      referrer: document.referrer,
    })
  }, [badPath, onLogNotFound])

  const handleRingBertrand = () => {
    window.dispatchEvent(
      new CustomEvent('bbb:open', {
        detail: buildNotFoundOpenEventDetail(badPath),
      }),
    )
  }

  return (
    <div className="catalog catalog-page catalog-page--shell">
      <div className="catalog-page__main">
        <main id="main-content" className="songbooks-page songbooks-page--missing catalog-not-found">
          <div className="catalog-not-found__inner">
            <h1 className="catalog-not-found__title">
              <span className="catalog-not-found__oops">OOOPS</span>
              <span className="catalog-not-found__prompt">[page not found]</span>
            </h1>
            <div className="catalog-not-found__actions">
              <Link to="/" className="catalog-not-found__cta catalog-not-found__cta--home">
                Peel Me Back Home
              </Link>
              <button
                type="button"
                className="catalog-not-found__cta catalog-not-found__cta--bbb"
                onClick={handleRingBertrand}
              >
                Ring Bertrand the Banana Butler
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
