import { useMemo, useState, type FormEvent } from 'react'
import { openFooterContactPanel } from '../catalog/footerContactConstants'
import { trackFormSubmit } from '../lib/analytics'
import { plainTextForFeedbackReview, type FeedbackIntentType } from './BbbChatUtils'
type BbbPageContext = {
  pathname: string
  search?: string
}


const DEFAULT_ENDPOINT = 'http://localhost:8787/api/bbb'
const bbbEndpointFromEnv =
  ((import.meta as ImportMeta & { env?: { VITE_BBB_API_ENDPOINT?: string } }).env?.VITE_BBB_API_ENDPOINT ?? '').trim()
const BBB_ENDPOINT = bbbEndpointFromEnv || DEFAULT_ENDPOINT

type FeedbackFormState = 'collecting' | 'reviewing' | 'sending' | 'sent' | 'error'

export type FeedbackPayload = {
  intentType: FeedbackIntentType
  message: string
  name: string
  email: string
  conversationTail?: string
  pageContext?: BbbPageContext
  sendCopy?: boolean
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidFeedbackEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

export function canReviewFeedbackForm(input: { message: string; name: string; email: string }): boolean {
  return input.message.trim().length > 0 && input.name.trim().length > 0 && isValidFeedbackEmail(input.email)
}

type Props = {
  intentType: FeedbackIntentType
  initialMessage?: string
  conversationTail?: string
  pageContext?: BbbPageContext
  onCancel: () => void
  onSent: () => void
}

export const feedbackIntentLabel = (intent: FeedbackIntentType): string => {
  if (intent === 'song-idea') return 'song idea'
  if (intent === 'bug-report') return 'bug report'
  if (intent === 'broken-link') return 'broken link'
  return 'feedback'
}

export function buildFeedbackPayload(input: {
  intentType: FeedbackIntentType
  message: string
  name: string
  email: string
  includeConversationTail: boolean
  conversationTail?: string
  pageContext?: BbbPageContext
  sendCopy?: boolean
}): FeedbackPayload {
  return {
    intentType: input.intentType,
    message: input.message.trim(),
    name: input.name.trim(),
    email: input.email.trim(),
    ...(input.includeConversationTail && input.conversationTail ? { conversationTail: input.conversationTail } : {}),
    ...(input.pageContext ? { pageContext: input.pageContext } : {}),
    ...(input.sendCopy ? { sendCopy: true } : {}),
  }
}

export function BbbFeedbackForm({ intentType, initialMessage, conversationTail, pageContext, onCancel, onSent }: Props) {
  const [message, setMessage] = useState(initialMessage?.trim() ?? '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [includeConversationTail, setIncludeConversationTail] = useState(Boolean(conversationTail))
  const [sendCopy, setSendCopy] = useState(false)
  const [state, setState] = useState<FeedbackFormState>('collecting')
  const [error, setError] = useState('')

  const canReview = canReviewFeedbackForm({ message, name, email })
  const tailPreview = useMemo(() => {
    const tail = plainTextForFeedbackReview(conversationTail ?? '')
    if (!tail) return ''
    return tail.length > 280 ? `${tail.slice(0, 280)}…` : tail
  }, [conversationTail])

  const payload = useMemo<FeedbackPayload>(
    () =>
      buildFeedbackPayload({
        intentType,
        message,
        name,
        email,
        includeConversationTail,
        conversationTail,
        pageContext,
        sendCopy,
      }),
    [intentType, message, name, email, includeConversationTail, conversationTail, pageContext, sendCopy],
  )

  const openFooterForm = () => {
    openFooterContactPanel()
  }

  const handleReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canReview) return
    setState('reviewing')
    setError('')
  }

  const handleSend = async () => {
    setState('sending')
    setError('')
    try {
      const response = await fetch(`${BBB_ENDPOINT}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        setError(`Send failed (${response.status}).`)
        setState('error')
        return
      }
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!body.ok) {
        setError(body.error ?? 'Send failed. Please retry or use the footer contact form.')
        setState('error')
        return
      }
      trackFormSubmit({
        intent_type: intentType,
        page_path: pageContext?.pathname,
      })
      setState('sent')
    } catch {
      setError('Network error while sending feedback.')
      setState('error')
    }
  }

  return (
    <div className="bbb-feedback" data-state={state}>
      {state === 'collecting' ? (
        <form className="bbb-feedback__form" onSubmit={handleReview}>
          <p className="bbb-feedback__title">Send Banana a {feedbackIntentLabel(intentType)}</p>
          <label className="bbb-feedback__label">
            Message
            <textarea
              className="bbb-feedback__textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              maxLength={5000}
              required
            />
          </label>
          <label className="bbb-feedback__label">
            Name <span className="bbb-feedback__req" aria-label="required">*</span>
            <input
              className="bbb-feedback__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label className="bbb-feedback__label">
            Email <span className="bbb-feedback__req" aria-label="required">*</span>
            <input
              className="bbb-feedback__input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="bbb-feedback__checkbox">
            <input
              type="checkbox"
              checked={sendCopy}
              onChange={(event) => setSendCopy(event.target.checked)}
            />
            Email me a copy of this message
          </label>
          {conversationTail ? (
            <label className="bbb-feedback__checkbox">
              <input
                type="checkbox"
                checked={includeConversationTail}
                onChange={(event) => setIncludeConversationTail(event.target.checked)}
              />
              Include last few exchanges for context
            </label>
          ) : null}
          <div className="bbb-feedback__actions">
            <button type="button" onClick={onCancel}>
              Back to chat
            </button>
            <button type="submit" disabled={!canReview}>
              Review
            </button>
          </div>
        </form>
      ) : null}

      {state === 'reviewing' ? (
        <div className="bbb-feedback__review">
          <p className="bbb-feedback__title">Review before sending</p>
          <dl className="bbb-feedback__review-list">
            <div className="bbb-feedback__review-item">
              <dt>Intent</dt>
              <dd>{feedbackIntentLabel(intentType)}</dd>
            </div>
            <div className="bbb-feedback__review-item">
              <dt>Name</dt>
              <dd>{payload.name}</dd>
            </div>
            <div className="bbb-feedback__review-item">
              <dt>Email</dt>
              <dd>{payload.email}</dd>
            </div>
            {sendCopy ? (
              <div className="bbb-feedback__review-item">
                <dt>Copy</dt>
                <dd>Email a copy to {payload.email}</dd>
              </div>
            ) : null}
            <div className="bbb-feedback__review-item bbb-feedback__review-item--block">
              <dt>Message</dt>
              <dd>{payload.message}</dd>
            </div>
            {includeConversationTail && tailPreview ? (
              <div className="bbb-feedback__review-item bbb-feedback__review-item--block">
                <dt>Recent chat</dt>
                <dd className="bbb-feedback__review-tail">{tailPreview}</dd>
              </div>
            ) : null}
          </dl>
          <div className="bbb-feedback__actions">
            <button type="button" onClick={() => setState('collecting')}>
              Edit
            </button>
            <button type="button" onClick={() => void handleSend()}>
              Send
            </button>
          </div>
        </div>
      ) : null}

      {state === 'sending' ? <p className="bbb-feedback__status">Sending your note…</p> : null}

      {state === 'sent' ? (
        <div className="bbb-feedback__done">
          <p>
            Sent. Banana has your note.
            {sendCopy ? ' If you asked for a copy, check your inbox.' : ''}
          </p>
          <button type="button" onClick={onSent}>
            Back to chat
          </button>
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="bbb-feedback__error">
          <p>{error}</p>
          <div className="bbb-feedback__actions">
            <button type="button" onClick={() => setState('reviewing')}>
              Retry
            </button>
            <button type="button" onClick={openFooterForm}>
              Open footer form
            </button>
            <button type="button" onClick={onCancel}>
              Back to chat
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
