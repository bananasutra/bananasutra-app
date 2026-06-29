import { Link } from 'react-router-dom'
import type { HomeHeroQuote } from './homePortalData'
import { sutraClassName } from './sutraTheme'
import { useTypewriterText } from './useTypewriterText'

type Props = {
  quote: HomeHeroQuote
}

/** W-064 hero — lyrics_extract pull-quote linked to song. */
export function HomePortalHeroQuote({ quote }: Props) {
  const sutraTone = sutraClassName(quote.sutra)
  const typedExtract = useTypewriterText(quote.extract)

  return (
    <Link className="home-hero-quote" to={quote.href}>
      <blockquote className="sutra-detail__pull-quote home-hero-quote__pull">
        <span className="sutra-detail__pull-quote-text home-hero-quote__text-inner">{typedExtract}</span>
        <span className="sutra-detail__pull-quote-caret" aria-hidden />
      </blockquote>
      <p className="home-hero-quote__meta">
        {quote.title}
        {quote.sutra ? (
          <>
            {' · '}
            <span className={`home-hero-quote__sutra catalog-facet-sutra-name ${sutraTone}`.trim()}>{quote.sutra}</span>
          </>
        ) : null}
        {' →'}
      </p>
    </Link>
  )
}
