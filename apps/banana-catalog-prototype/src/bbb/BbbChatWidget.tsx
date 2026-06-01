import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './BbbChatWidget.css'
import { loadSongCatalogBrowse } from '../catalog/generatedData'
import { toBbbPageContextPathname } from './notFoundRouting'
import { registerBbbOpenListener } from './openEvent'
import {
  capConversationHistory,
  getOrCreateActorId,
  parseInlineEmphasis,
  parseMarkdownLinks,
  parseSseChunk,
  updateLastAssistant,
  type ChatMessage,
} from './BbbChatUtils'

const DEFAULT_ENDPOINT = 'http://localhost:8787/api/bbb'
const BBB_ENDPOINT = import.meta.env.VITE_BBB_API_ENDPOINT?.trim() || DEFAULT_ENDPOINT
const INITIAL_ASSISTANT_TEXT =
  'Welcome. I am Bertrand, your Banana Butler. But(t) you can call me BBB. This place is a library of songs that tell stories that matter, through the lens of the seven sutras. How may I best serve you?'
const INITIAL_ASSISTANT_NOT_FOUND_TEXT =
  "OOOPS detour. I can help you get back on track. Were you looking for a specific song, sutra, or vibe?"
const INITIAL_ASSISTANT_BACK_ON_TRACK_TEXT =
  'Back on track. Want a quick recommendation, or would you rather browse by sutra, songbook, or vibe?'

const isDefaultIntroOnly = (messages: ChatMessage[]): boolean =>
  messages.length === 1 && messages[0]?.role === 'assistant' && messages[0]?.content === INITIAL_ASSISTANT_TEXT
const isNotFoundIntroOnly = (messages: ChatMessage[]): boolean =>
  messages.length === 1 && messages[0]?.role === 'assistant' && messages[0]?.content === INITIAL_ASSISTANT_NOT_FOUND_TEXT

export function BbbChatWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: INITIAL_ASSISTANT_TEXT }])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [songTitleBySlug, setSongTitleBySlug] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const openedFromNotFoundRef = useRef(false)

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming])
  const actorId = useMemo(() => getOrCreateActorId(), [])
  const toggleLabel = open ? 'Close Bertrand' : 'Ring Bertrand'

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    return registerBbbOpenListener((detail) => {
      setOpen(true)
      if (detail?.reason !== '404') return
      openedFromNotFoundRef.current = true
      setMessages((prev) => (isDefaultIntroOnly(prev) ? [{ role: 'assistant', content: INITIAL_ASSISTANT_NOT_FOUND_TEXT }] : prev))
    })
  }, [])

  useEffect(() => {
    if (location.pathname === '/oops') return
    if (!openedFromNotFoundRef.current) return
    openedFromNotFoundRef.current = false
    setMessages((prev) => (isNotFoundIntroOnly(prev) ? [{ role: 'assistant', content: INITIAL_ASSISTANT_BACK_ON_TRACK_TEXT }] : prev))
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    if (Object.keys(songTitleBySlug).length > 0) return
    void loadSongCatalogBrowse()
      .then((rows) => {
        const bySlug: Record<string, string> = {}
        for (const row of rows) {
          const slug = row.url_slug?.trim()
          const title = row.lyrics_title?.trim()
          if (!slug || !title) continue
          bySlug[slug] = title
        }
        setSongTitleBySlug(bySlug)
      })
      .catch(() => {
        // Keep chat usable if catalog fetch fails; link labels will fall back.
      })
  }, [open, songTitleBySlug])

  const resolveSongLinkLabel = (rawLabel: string, href: string): string => {
    const normalizedHref = href.split('?')[0]?.split('#')[0] ?? href
    if (!normalizedHref.startsWith('/songs/')) return rawLabel
    const slug = normalizedHref.slice('/songs/'.length).trim()
    if (!slug) return rawLabel

    if (songTitleBySlug[slug]) return songTitleBySlug[slug] as string
    if (rawLabel === href || rawLabel === normalizedHref) {
      return slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    }
    return rawLabel
  }

  const renderInlineText = (text: string, keyPrefix: string) =>
    parseInlineEmphasis(text).map((piece, idx) =>
      piece.bold ? (
        <strong key={`${keyPrefix}-b-${idx}`}>{piece.text}</strong>
      ) : piece.italic ? (
        <em key={`${keyPrefix}-i-${idx}`}>{piece.text}</em>
      ) : (
        <span key={`${keyPrefix}-t-${idx}`}>{piece.text}</span>
      ),
    )

  const scrollToBottom = () => {
    const node = historyRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }

  const submitPrompt = async (prompt: string) => {
    const nextMessages = [...messages, { role: 'user' as const, content: prompt }, { role: 'assistant' as const, content: '' }]
    setMessages(nextMessages)
    setIsStreaming(true)
    setError('')
    queueMicrotask(scrollToBottom)

    const streamMessages = capConversationHistory(nextMessages, 5)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(BBB_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BBB-Actor': actorId },
        body: JSON.stringify({
          messages: streamMessages,
          pageContext: {
            pathname: toBbbPageContextPathname(location.pathname),
            search: location.search,
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const fallback = 'BBB request failed. Please retry.'
        setMessages((prev) => updateLastAssistant(prev, fallback))
        setError(`Request failed (${response.status})`)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      let assistantText = ''
      let streamFinished = false
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })

        const completeBlocks = pending.split('\n\n')
        pending = completeBlocks.pop() ?? ''
        const parsedEvents = parseSseChunk(completeBlocks.join('\n\n'))

        for (const event of parsedEvents) {
          if (event.event === 'token') {
            const tokenText = (event.payload as { text?: string })?.text ?? ''
            assistantText += tokenText
            setMessages((prev) => updateLastAssistant(prev, assistantText))
          } else if (event.event === 'error') {
            const message = (event.payload as { message?: string })?.message || 'Streaming error'
            setError(message)
          } else if (event.event === 'done') {
            streamFinished = true
            break
          }
        }
        queueMicrotask(scrollToBottom)
        if (streamFinished) break
      }

      if (!assistantText.trim() && !streamFinished) {
        setMessages((prev) => updateLastAssistant(prev, 'I am chewing on that one. Please try again.'))
      }
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError') {
        setError('Network error while streaming BBB response.')
        setMessages((prev) => updateLastAssistant(prev, 'I lost the banana signal. Please try again.'))
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      queueMicrotask(scrollToBottom)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || isStreaming) return
    setInput('')
    await submitPrompt(prompt)
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    if (!event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    if (!canSend) return
    const prompt = input.trim()
    setInput('')
    void submitPrompt(prompt)
  }

  return (
    <section className={`bbb-widget${open ? ' is-open' : ''}`} aria-label="Bertrand chat widget">
      <button
        type="button"
        className="bbb-widget__toggle"
        aria-expanded={open}
        aria-controls="bbb-widget-panel"
        aria-label={open ? 'Close Bertrand chat widget' : 'Open Bertrand chat widget'}
        onClick={() => setOpen((prev) => !prev)}
      >
        {toggleLabel}
      </button>
      {open ? (
        <div id="bbb-widget-panel" className="bbb-widget__panel">
          <header className="bbb-widget__header">
            <p className="bbb-widget__title">Bertrand · Banana Butler</p>
            <p className="bbb-widget__subtitle">At your service, one hidden gem at a time</p>
          </header>
          <div ref={historyRef} className="bbb-widget__history" aria-live="polite" aria-busy={isStreaming}>
            {messages.map((message, idx) => (
              <p key={`${message.role}-${idx}`} className={`bbb-widget__msg bbb-widget__msg--${message.role}`}>
                {message.content
                  ? parseMarkdownLinks(message.content).map((segment, segmentIdx) =>
                      segment.type === 'link' ? (
                        <a
                          key={`seg-${idx}-${segmentIdx}`}
                          className="bbb-widget__link"
                          href={segment.href}
                          target={segment.external ? '_blank' : undefined}
                          rel={segment.external ? 'noreferrer noopener' : undefined}
                          onClick={(event) => {
                            if (segment.external) return
                            event.preventDefault()
                            navigate(segment.href)
                          }}
                        >
                          {renderInlineText(resolveSongLinkLabel(segment.text, segment.href), `link-${idx}-${segmentIdx}`)}
                        </a>
                      ) : (
                        <span key={`seg-${idx}-${segmentIdx}`}>
                          {renderInlineText(segment.text, `text-${idx}-${segmentIdx}`)}
                        </span>
                      ),
                    )
                  : message.role === 'assistant'
                    ? '...'
                    : ''}
              </p>
            ))}
          </div>
          {error ? <p className="bbb-widget__error">{error}</p> : null}
          <form className="bbb-widget__composer" onSubmit={handleSubmit}>
            <label htmlFor="bbb-widget-input" className="visually-hidden">
              Ask Bertrand
            </label>
            <textarea
              id="bbb-widget-input"
              ref={inputRef}
              className="bbb-widget__input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="How may I best serve your ears and soul today?"
              rows={2}
              disabled={isStreaming}
            />
            <p className="bbb-widget__hint">Try: "I need hope" or "Give me French hidden gems"</p>
            <div className="bbb-widget__actions">
              <button type="submit" className="bbb-widget__send" disabled={!canSend}>
                Send
              </button>
              {isStreaming ? (
                <button type="button" className="bbb-widget__stop" onClick={handleStop}>
                  Stop
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
