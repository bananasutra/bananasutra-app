import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { renderPageMeta } from './usePageMeta'

const ABOUT_JUMP_NAV_ITEMS = [
  { id: 'what', label: 'What is Bananasutra', mobileLabel: 'What is?' },
  { id: 'who', label: 'Who is behind it', mobileLabel: 'Who?' },
  { id: 'colophon', label: 'Colophon' },
] as const

export function AboutContent() {
  const location = useLocation()
  const navigate = useNavigate()

  const pageMeta = renderPageMeta({
    title: 'About Bananasutra',
    description:
      'What is BANANASUTRA? Songs organized by meaning, not genre, rooted in seven sutras and built by one human with practical tools.',
    path: '/about',
  })

  useEffect(() => {
    if (location.hash === '#sutras') {
      navigate('/about/sutras', { replace: true })
    }
  }, [location.hash, navigate])

  return (
    <>
    {pageMeta}
      <div className="catalog-page-shell__jump-region">
        <CatalogPageJumpNav items={[...ABOUT_JUMP_NAV_ITEMS]} />
      </div>

      <div className="about-page__body">
        <section className="about-page__section" aria-labelledby="what">
          <h2 id="what" className="catalog-section-title about-page__anchor-target">
            What is Bananasutra
          </h2>
          <div className="about-page__prose">
            <p>
              Probably not what you think. &ldquo;Banana&rdquo; is slang for crazy, chaos, and the emoji speaks for itself
              in a world run mostly by men whose logic starts south of the belt. &ldquo;Sutra&rdquo; means teaching, thread,
              story. Put them together: stories that matter, in a world gone bananas.
            </p>
            <p>
              BANANASUTRA is a living collection of songs organized by meaning, not genre. Every song has a sutra (a
              guiding question), a topic, sometimes a muse, sometimes a character, and a short paragraph on why it
              exists. The collection is meaning-first: not sorted by algorithm or mood, but by the question each song is
              trying to ask.
            </p>
            <p>
              I invented the sutras to help me remember what matters. The corporate algorithm wants us numb. Empathy
              gets called naive. Lying is strategy. The seven sutras are my compass, seven north stars I can defend and
              return to. They aren&apos;t taxonomy. They&apos;re a tool for staying sane.
            </p>
            <p>
              I believe music is the most universal language. I believe creativity is intelligence having fun (thanks,
              maybe-Einstein). And I believe songs with real meaning can help people get and stay more connected, more
              aware, more brave, in the deadly jungle of corporate nonsense ruled by apes gone wrong.
            </p>
          </div>
        </section>

        <section className="about-page__section" aria-labelledby="who">
          <h2 id="who" className="catalog-section-title about-page__anchor-target">
            Who is behind it
          </h2>
          <div className="about-page__prose">
            <p>
              One person. Philosophy and math background (the combo of curiosity and rigor that makes you question
              everything, then prove it). I write the lyrics, prompt the music, clone my own voice for the dubs, make
              the cover art and videos, and built this app. 400+ songs, 2000+ tracks, in 2 years. Not bragging, just
              clarifying: this whole thing is homemade, end to end.
            </p>
            <p>Why? Because I agree with Frank Zappa: music is the only religion that delivers the goods.</p>
          </div>
        </section>

        <section className="about-page__section" aria-labelledby="colophon">
          <h2 id="colophon" className="catalog-section-title about-page__anchor-target">
            Colophon
          </h2>
          <dl className="about-page__colophon-list">
            <div className="about-page__colophon-row">
              <dt className="about-page__colophon-label">Lyrics</dt>
              <dd className="about-page__colophon-value">
                100% human-written. Every word is mine. The stories, the wordplay, the questions, the opinions, the
                tenderness. All of it.
              </dd>
            </div>
            <div className="about-page__colophon-row">
              <dt className="about-page__colophon-label">Music</dt>
              <dd className="about-page__colophon-value">
                Produced with Suno, an AI music tool. I write detailed prompts describing genre, mood, instrumentation,
                structure, tempo. Think of it like directing a session musician who never gets tired. Sometimes it takes
                20+ generations to get a track right. The AI does not write lyrics or decide what the song is about.
                Ever.
              </dd>
            </div>
            <div className="about-page__colophon-row">
              <dt className="about-page__colophon-label">Voice</dt>
              <dd className="about-page__colophon-value">
                French-American voiceover dub, cloned from my own voice for consistency across the catalog.
              </dd>
            </div>
            <div className="about-page__colophon-row">
              <dt className="about-page__colophon-label">Cover art &amp; videos</dt>
              <dd className="about-page__colophon-value">
                Made by me using a mix of AI image tools, video editors, and imagination.
              </dd>
            </div>
            <div className="about-page__colophon-row">
              <dt className="about-page__colophon-label">This app</dt>
              <dd className="about-page__colophon-value">
                React + TypeScript (Vite, React Router), powered by Airtable as CMS, with Python scripts for data
                processing. Built with Cursor and Claude. Embeds from SoundCloud and YouTube. Catalog numbers, filters,
                and embeds reflect a dated export, not a live mirror. The site footer shows the snapshot date.
              </dd>
            </div>
          </dl>
          <p className="about-page__colophon-tldr">
            <strong>In short:</strong> the ideas are human. The tools are whatever gets the job done. If that offends
            purists on either side, well... it&apos;s bananas.
          </p>
        </section>

      </div>
    </>
  )
}
