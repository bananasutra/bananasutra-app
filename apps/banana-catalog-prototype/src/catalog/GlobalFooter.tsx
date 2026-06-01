import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FOOTER_CONTACT_OPEN_EVENT, FOOTER_CONTACT_PANEL_HASH } from './footerContactConstants'
import { CATALOG_SNAPSHOT_DATE, formatCatalogSnapshotDate } from './catalogSnapshotMeta'
import { canonicalPathForRoute } from './seoPaths'
import { FooterSocialIcon, type FooterSocialId } from './FooterSocialIcons'
import './GlobalFooter.css'

/* ------------------------------------------------------------------ */
/*  Social links                                                       */
/* ------------------------------------------------------------------ */

const SOCIAL: readonly { id: FooterSocialId; href: string; label: string }[] = [
  { id: 'soundcloud', href: 'https://soundcloud.com/bananasutra/sets', label: 'SoundCloud' },
  { id: 'youtube', href: 'https://www.youtube.com/@bananasutra', label: 'YouTube' },
  { id: 'instagram', href: 'https://www.instagram.com/itsbananasutra/', label: 'Instagram' },
  { id: 'suno', href: 'https://suno.com/@bananasutra', label: 'Suno' },
  { id: 'substack', href: 'https://substack.com/@bananasutra', label: 'Substack' },
  { id: 'github', href: 'https://github.com/bananasutra', label: 'GitHub' },
]

/* ------------------------------------------------------------------ */
/*  Contact form config                                                */
/* ------------------------------------------------------------------ */

const APPS_SCRIPT_URL = import.meta.env.VITE_CONTACT_ENDPOINT ?? ''
const MIN_SUBMIT_DELAY_MS = 3_000
const MAX_SUBMISSIONS_PER_SESSION = 3
let sessionSubmitCount = 0

type FormStatus = 'idle' | 'sending' | 'sent' | 'error'
type FormFields = { name: string; email: string; message: string }
const EMPTY: FormFields = { name: '', email: '', message: '' }

/* ------------------------------------------------------------------ */
/*  Footer contact form (collapsible)                                  */
/* ------------------------------------------------------------------ */

function FooterContactForm() {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<FormFields>(EMPTY)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [sendCopy, setSendCopy] = useState(false)
  const [requestedCopy, setRequestedCopy] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const loadedAt = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadedAt.current = Date.now()
  }, [])

  /* Reset timing on open so the 3-second guard starts from reveal, not page load. */
  useEffect(() => {
    if (open) loadedAt.current = Date.now()
  }, [open])

  /* Deep links (#footer-contact-panel) and BBB fallback should expand, not just scroll. */
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === FOOTER_CONTACT_PANEL_HASH) setOpen(true)
    }
    const openFromEvent = () => setOpen(true)

    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    window.addEventListener(FOOTER_CONTACT_OPEN_EVENT, openFromEvent)
    return () => {
      window.removeEventListener('hashchange', openFromHash)
      window.removeEventListener(FOOTER_CONTACT_OPEN_EVENT, openFromEvent)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target
      setFields((prev) => ({ ...prev, [name]: value }))
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErrorMsg('')

      if (honeypot) return
      if (Date.now() - loadedAt.current < MIN_SUBMIT_DELAY_MS) {
        setErrorMsg('That was a little too fast — please wait a moment and try again.')
        return
      }
      if (sessionSubmitCount >= MAX_SUBMISSIONS_PER_SESSION) {
        setErrorMsg("You've sent several messages already — please try again later.")
        return
      }
      if (!fields.name.trim() || !fields.email.trim() || !fields.message.trim()) {
        setErrorMsg('Please fill in all required fields.')
        return
      }
      if (!APPS_SCRIPT_URL) {
        setErrorMsg('Contact endpoint is not configured yet — please try again later.')
        return
      }

      setStatus('sending')
      try {
        const params = new URLSearchParams({
          name: fields.name.trim(),
          email: fields.email.trim(),
          subject: '',
          message: fields.message.trim(),
          _timestamp: new Date().toISOString(),
        })
        if (sendCopy) params.set('sendCopy', 'true')

        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })
        sessionSubmitCount++
        setRequestedCopy(sendCopy)
        setFields(EMPTY)
        setSendCopy(false)
        setStatus('sent')
      } catch {
        setStatus('error')
        setErrorMsg('Something went wrong — please try again or email me directly.')
      }
    },
    [fields, honeypot, sendCopy],
  )

  const handleReset = useCallback(() => {
    setStatus('idle')
    setErrorMsg('')
    setSendCopy(false)
    setRequestedCopy(false)
    loadedAt.current = Date.now()
  }, [])

  return (
    <div className={`footer-contact${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="footer-contact__toggle"
        aria-expanded={open}
        aria-controls="footer-contact-panel"
        onClick={() => {
          setOpen((v) => !v)
          if (!open && status === 'sent') handleReset()
        }}
      >
        <span className="footer-contact__toggle-label">
          {status === 'sent' && open ? 'Message sent!' : 'Questions? Feedback? Get in touch'}
        </span>
        <span className={`footer-contact__toggle-chevron${open ? ' is-open' : ''}`} aria-hidden />
      </button>

      <div
        id="footer-contact-panel"
        ref={contentRef}
        className={`footer-contact__panel${open ? ' is-open' : ''}`}
      >
        <div className="footer-contact__panel-inner">
          {status === 'sent' ? (
            <div className="footer-contact__success" role="status">
              <p className="footer-contact__success-text">
                Thanks for reaching out. I'll get back to you soon.
                {requestedCopy ? ' If you asked for a copy, check your inbox.' : ''}
              </p>
              <button type="button" className="footer-contact__link-btn" onClick={handleReset}>
                Send another message
              </button>
            </div>
          ) : (
            <form
              className="footer-contact__form"
              onSubmit={handleSubmit}
              noValidate
              autoComplete="off"
            >
              {/* Honeypot — name must not match any autofill heuristic */}
              <div className="footer-contact__hp" aria-hidden="true">
                <label htmlFor="footer-hp-f8x">Do not fill this</label>
                <input
                  type="text"
                  id="footer-hp-f8x"
                  name="company_fax_8x"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Left column: name + email */}
              <div className="footer-contact__col-left">
                <div className="footer-contact__field">
                  <label htmlFor="footer-name" className="footer-contact__label">
                    Name <span className="footer-contact__req" aria-label="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="footer-name"
                    name="name"
                    className="footer-contact__input"
                    value={fields.name}
                    onChange={handleChange}
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </div>

                <div className="footer-contact__field">
                  <label htmlFor="footer-email" className="footer-contact__label">
                    Email <span className="footer-contact__req" aria-label="required">*</span>
                  </label>
                  <input
                    type="email"
                    id="footer-email"
                    name="email"
                    className="footer-contact__input"
                    value={fields.email}
                    onChange={handleChange}
                    required
                    maxLength={200}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Right column: message + submit */}
              <div className="footer-contact__col-right">
                <div className="footer-contact__field footer-contact__field--message">
                  <label htmlFor="footer-message" className="footer-contact__label">
                    Message <span className="footer-contact__req" aria-label="required">*</span>
                  </label>
                  <textarea
                    id="footer-message"
                    name="message"
                    className="footer-contact__textarea"
                    value={fields.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    maxLength={5000}
                  />
                </div>

                <label className="footer-contact__checkbox">
                  <input
                    type="checkbox"
                    checked={sendCopy}
                    onChange={(event) => setSendCopy(event.target.checked)}
                  />
                  Email me a copy of this message
                </label>

                {errorMsg && (
                  <p className="footer-contact__error" role="alert">
                    {errorMsg}
                  </p>
                )}

                <div className="footer-contact__actions">
                  <button
                    type="submit"
                    className="footer-contact__submit"
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  GlobalFooter                                                       */
/* ------------------------------------------------------------------ */

export function GlobalFooter() {
  const y = new Date().getFullYear()

  return (
    <footer className="catalog-footer" role="contentinfo">
      <div className="catalog-footer__inner">
        {/* ---- Contact form (collapsible) ---- */}
        <FooterContactForm />

        {/* ---- Social icons ---- */}
        <nav className="catalog-footer__social" aria-label="Elsewhere on the web">
          <ul className="catalog-footer__social-list">
            {SOCIAL.map(({ id, href, label }) => (
              <li key={href} className="catalog-footer__social-item">
                <a
                  className="catalog-footer__social-link"
                  href={href}
                  rel="me noreferrer noopener"
                  target="_blank"
                  aria-label={`${label} (opens in new tab)`}
                >
                  <FooterSocialIcon id={id} className={`catalog-footer__social-icon catalog-footer__social-icon--${id}`} />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* ---- Sitemap link + snapshot date ---- */}
        <p className="catalog-footer__meta">
          <Link to={canonicalPathForRoute('/sitemap')} className="catalog-footer__sitemap-link">
            SITEMAP
          </Link>
          {CATALOG_SNAPSHOT_DATE ? (
            <>
              <span className="catalog-footer__meta-sep" aria-hidden> · </span>
              <span className="catalog-footer__snapshot-text">
                Last updated {formatCatalogSnapshotDate(CATALOG_SNAPSHOT_DATE)}
              </span>
            </>
          ) : null}
        </p>

        {/* ---- Copyright ---- */}
        <p className="catalog-footer__legal">
          <span className="catalog-footer__copyright">© {y} BANANASUTRA</span>
          <span className="catalog-footer__sep" aria-hidden>
            {' '}.{' '}
          </span>
          <span className="catalog-footer__tagline">Curious. Kind. Silly. Human.</span>
        </p>
      </div>
    </footer>
  )
}
