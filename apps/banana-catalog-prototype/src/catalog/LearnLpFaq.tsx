import { LEARN_FAQ_ITEMS } from './learnLpData'

export function LearnLpFaq() {
  return (
    <section className="catalog-page-shell__section learn-lp__faq" aria-labelledby="learn-lp-faq-heading">
      <h2 id="learn-lp-faq-heading" className="catalog-section-title">
        Things every first visitor asks
      </h2>
      <p className="learn-lp__section-intro">Three questions every first visit asks. Answered plain.</p>
      <div className="learn-lp__faq-list">
        {LEARN_FAQ_ITEMS.map((item) => (
          <details key={item.question} className="learn-lp__faq-item">
            <summary className="learn-lp__faq-q">{item.question}</summary>
            <div className="learn-lp__faq-a">
              <p>{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
