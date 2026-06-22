import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { SutraFamilyKey } from './sutraContext'
import { sutraHrefForFamily } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'

const SUTRA_GLANCE: ReadonlyArray<{ key: SutraFamilyKey; tagline: string }> = [
  { key: 'KNOW', tagline: 'where we ask and learn' },
  { key: 'BLOW', tagline: 'where we speak of pricks' },
  { key: 'SHOW', tagline: 'where we play and laugh' },
  { key: 'GROW', tagline: 'where we care and dare' },
  { key: 'FLOW', tagline: 'where we leap and fly' },
  { key: 'GLOW', tagline: 'where we blink and blush' },
  { key: 'BOW', tagline: 'where we surrender' },
]

export function AboutContent() {
  const location = useLocation()
  const navigate = useNavigate()

  const pageMeta = renderPageMeta({
    title: 'About Bananasutra',
    description:
      'What is BANANASUTRA? Songs organized by meaning, not genre — ideas you can feel, rooted in seven sutras and built by one human with practical tools.',
    path: canonicalPathForRoute('/about'),
  })

  useEffect(() => {
    if (location.hash === '#sutras') {
      navigate(canonicalPathForRoute('/sutras'), { replace: true })
    }
  }, [location.hash, navigate])

  return (
    <>
      {pageMeta}

      <div className="about-page__body">
        <section className="about-page__section" aria-labelledby="what">
          <h2 id="what" className="catalog-section-title about-page__anchor-target">
            What is Bananasutra
          </h2>
          <div className="about-page__prose">
            <p>
              It&apos;s not a bible. It&apos;s not a gospel. It&apos;s not a book. It&apos;s not an album. It&apos;s not a
              musical. It&apos;s a magic world of wonders to wander in. It&apos;s a warm, honest conversation, and sometimes
              just a silly joke. It&apos;s a dance, it&apos;s a cry, it&apos;s a laugh. It&apos;s what a friend would want to
              tell a friend, or maybe a parent to a kid. It&apos;s not just songs. It&apos;s important questions, and clear
              intentions. It&apos;s true stories that matter. It&apos;s ideas you can feel.
            </p>
            <p>
              Why music? Because I agree with Frank Zappa: music is the only religion that delivers the goods.
            </p>
            <h3 className="about-page__subhead">So what does the name actually mean?</h3>
            <p>
              Probably not what you think. &ldquo;Banana&rdquo; is slang for crazy, chaos, and the emoji speaks for itself
              in a world run mostly by men whose logic starts south of the belt. &ldquo;Sutra&rdquo; means teaching, thread,
              story. Put them together: stories that matter, in a world gone bananas.
            </p>
            <p>
              BANANASUTRA is a living collection of songs organized by meaning, not genre. Every song has a sutra (a
              guiding question), a topic, sometimes a muse, sometimes a character, and a short paragraph on why it exists.
              Meaning-first: not sorted by algorithm or mood, but by the question each song is trying to ask.
            </p>
            <p>
              I invented the sutras to help me remember what matters. The corporate algorithm wants us numb. Empathy gets
              called naive. Lying is strategy. The seven sutras are my compass, seven north stars I can defend and return
              to. They aren&apos;t taxonomy. They&apos;re a tool for staying sane.
            </p>
            <p>
              Music is the most universal language. Creativity is intelligence having fun (thanks, maybe-Einstein). Songs
              with real meaning can help people get and stay more connected, more aware, more brave, in the deadly jungle of
              corporate nonsense ruled by apes gone wrong.
            </p>
          </div>
        </section>

        <section className="about-page__section" aria-labelledby="sutras-glance">
          <h2 id="sutras-glance" className="catalog-section-title about-page__anchor-target">
            Sutras at a glance
          </h2>
          <ul className="about-page__sutra-glance">
            {SUTRA_GLANCE.map(({ key, tagline }) => (
              <li key={key}>
                <Link
                  className={`about-page__sutra-glance-item ${sutraClassName(key)}`}
                  to={sutraHrefForFamily(key)}
                >
                  <span className="about-page__sutra-glance-name">{key}</span>
                  <span className="about-page__sutra-glance-tagline">{tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="about-page__sutra-glance-more">
            <Link className="about-page__text-link" to={canonicalPathForRoute('/sutras')}>
              Learn more about the sutras →
            </Link>
          </p>
        </section>

        <section className="about-page__section" aria-labelledby="who">
          <h2 id="who" className="catalog-section-title about-page__anchor-target">
            Who&apos;s behind it
          </h2>
          <div className="about-page__prose">
            <p>
              One person. Philosophy and math background (the combo of curiosity and rigor that makes you question
              everything, then prove it). I write the lyrics, prompt the music, clone my own voice for the dubs, make the
              cover art and videos, and built this app. 400+ songs, 2,000+ tracks, in 2 years. Not bragging, just
              clarifying: this whole thing is homemade, end to end.
            </p>
            <p>
              How the music gets made: lyrics first (all mine), then Suno generates backing tracks from those words and
              style prompts, then I dub my voice on top, then visuals last. The{' '}
              <a className="about-page__text-link" href="#colophon">
                colophon below
              </a>{' '}
              has the full breakdown (lyrics, Suno, voice, cover art, and this app).
            </p>
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
                Produced with Suno, an AI music tool. I write detailed prompts: genre, mood, instrumentation, structure,
                tempo. Think of it like directing a session musician who never gets tired. Sometimes it takes 20+
                generations to get a track right. The AI does not write lyrics or decide what a song is about. Ever.
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
                React + TypeScript (Vite, React Router), Airtable as CMS, Python scripts for data processing. Built with
                Cursor and Claude. Embeds from SoundCloud and YouTube. Catalog numbers, filters, and embeds reflect a dated
                export, not a live mirror. The footer shows the snapshot date.
              </dd>
            </div>
          </dl>
          <p className="about-page__colophon-tldr">
            The ideas are human. The tools are whatever gets the job done. If that offends purists on either side, well...
            it&apos;s bananas.
          </p>
        </section>
      </div>
    </>
  )
}
