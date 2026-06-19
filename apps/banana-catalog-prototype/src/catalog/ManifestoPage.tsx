import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import {
  MANIFESTO_ATTRIBUTION,
  MANIFESTO_CTA,
  MANIFESTO_DIALOGUE,
  MANIFESTO_FRAMEWORK,
  MANIFESTO_FRAMEWORK_LEDE,
  MANIFESTO_META,
  MANIFESTO_PULL_QUOTE,
} from './manifestoContent'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './ManifestoPage.css'

function ManifestoDialogueSection() {
  return (
    <section className="manifesto-page__section manifesto-page__section--dialogue" aria-labelledby="manifesto-dialogue-heading">
      <h2 id="manifesto-dialogue-heading" className="manifesto-page__section-title">
        Meanwhile, in a Paris bar…
      </h2>
      <div className="manifesto-dialogue">
        {MANIFESTO_DIALOGUE.map((block, index) => {
          if (block.type === 'scene') {
            return (
              <p key={index} className="manifesto-scene">
                {block.text}
              </p>
            )
          }
          if (block.type === 'stage') {
            return (
              <p key={index} className="manifesto-stage">
                {block.text}
              </p>
            )
          }
          return (
            <p key={index} className="manifesto-line">
              <span className="manifesto-char">{block.speaker}</span>
              {block.text}
            </p>
          )
        })}
      </div>
    </section>
  )
}

export function ManifestoPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  const pageMeta = renderPageMeta({
    title: MANIFESTO_META.title,
    description: MANIFESTO_META.description,
    path: canonicalPathForRoute('/manifesto'),
    publishedAt: MANIFESTO_META.publishedAt,
  })

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell manifesto-page">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell manifesto-page__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Manifesto
            </span>
          </nav>

          <header className="manifesto-page__hero">
            <p className="manifesto-page__eyebrow">AI art fair use</p>
            <h1 className="manifesto-page__title">A(rt) fair use manifesto</h1>
            <p className="manifesto-page__subtitle">Authentic imagination vs. artificial ignorance</p>
            <p className="manifesto-page__meta">
              Living document · Banana + AI tools · First published May 2024
            </p>
          </header>

          <section className="manifesto-page__section manifesto-page__section--framework" aria-labelledby="manifesto-framework-heading">
            <h2 id="manifesto-framework-heading" className="manifesto-page__section-title">
              {MANIFESTO_FRAMEWORK_LEDE}
            </h2>
            <div className="manifesto-framework">
              {MANIFESTO_FRAMEWORK.map((pillar) => (
                <article key={pillar.name} className="manifesto-band">
                  <header className="manifesto-band__head">
                    <h3 className="manifesto-band__title">
                      {pillar.name} = {pillar.sub}
                    </h3>
                  </header>
                  <div className="manifesto-band__grid">
                    {pillar.principles.map((principle, index) => (
                      <div key={principle.title} className="manifesto-cell">
                        <h4 className="manifesto-cell__title">
                          <span className="manifesto-cell__num">{index + 1}</span>
                          {principle.title}
                        </h4>
                        <p className="manifesto-cell__body">{principle.body}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            className="manifesto-page__section manifesto-page__section--pullquote"
            aria-labelledby="manifesto-preamble-heading"
          >
            <h2 id="manifesto-preamble-heading" className="manifesto-page__section-title">
              Preamble
            </h2>
            <blockquote className="manifesto-pullquote">
              <p className="manifesto-pullquote__text">{MANIFESTO_PULL_QUOTE.text}</p>
              <cite className="manifesto-pullquote__em">{MANIFESTO_PULL_QUOTE.em}</cite>
            </blockquote>
          </section>

          <ManifestoDialogueSection />

          <section
            className="manifesto-page__section manifesto-page__section--closing"
            aria-labelledby="manifesto-cta-heading"
          >
            <h2 id="manifesto-cta-heading" className="manifesto-page__section-title">
              Call to action
            </h2>
            <div className="manifesto-cta">
              {MANIFESTO_CTA.map((block) => (
                <p key={block} className="manifesto-cta__block">
                  {block}
                </p>
              ))}
            </div>
            <p className="manifesto-attribution">{MANIFESTO_ATTRIBUTION}</p>
          </section>
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
