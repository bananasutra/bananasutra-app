import { useMemo, useRef, useState, type FormEvent } from 'react'
import './BbbChatWidget.css'

type Role = 'user' | 'assistant'

type ChatMessage = {
  role: Role
  content: string
}

type BbbSseEvent = {
  event: string
  payload: unknown
}

const DEFAULT_ENDPOINT = 'http://localhost:8787/api/bbb'
const BBB_ENDPOINT = import.meta.env.VITE_BBB_API_ENDPOINT?.trim() || DEFAULT_ENDPOINT
const INITIAL_ASSISTANT_TEXT =
  'Welcome. I am Bertrand, your Banana Butler. But(t) you can call me BBB. This place is a library of songs that tell stories that matter through the seven sutras. How may I best serve you?'

function parseSseChunk(rawChunk: string): BbbSseEvent[] {
  const events: BbbSseEvent[] = []
  const blocks = rawChunk.split('\n\n')
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const lines = trimmed.split('\n')
    let event = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
    }
    if (!dataLines.length) continue
    try {
      events.push({ event, payload: JSON.parse(dataLines.join('\n')) })
    } catch {
      // Skip malformed payloads so one noisy chunk does not kill the stream.
    }
  }
  return events
}

function updateLastAssistant(messages: ChatMessage[], nextText: string): ChatMessage[] {
  if (!messages.length || messages[messages.length - 1]?.role !== 'assistant') {
    return [...messages, { role: 'assistant', content: nextText }]
  }
  const next = [...messages]
  const last = next[next.length - 1]
  next[next.length - 1] = { ...last, content: nextText }
  return next
}

export function BbbChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: INITIAL_ASSISTANT_TEXT }])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming])

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

    const streamMessages = nextMessages.filter((message) => message.content.trim().length > 0)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(BBB_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: streamMessages }),
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
            break
          }
        }
        queueMicrotask(scrollToBottom)
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

  return (
    <section className={`bbb-widget${open ? ' is-open' : ''}`} aria-label="Bertrand chat widget">
      <button
        type="button"
        className="bbb-widget__toggle"
        aria-expanded={open}
        aria-controls="bbb-widget-panel"
        onClick={() => setOpen((prev) => !prev)}
      >
        BBB Chat
      </button>
      {open ? (
        <div id="bbb-widget-panel" className="bbb-widget__panel">
          <header className="bbb-widget__header">
            <p className="bbb-widget__title">Bertrand (R42 MVP)</p>
            <p className="bbb-widget__subtitle">Streaming worker client</p>
          </header>
          <div ref={historyRef} className="bbb-widget__history" aria-live="polite">
            {messages.map((message, idx) => (
              <p key={`${message.role}-${idx}`} className={`bbb-widget__msg bbb-widget__msg--${message.role}`}>
                {message.content || (message.role === 'assistant' ? '...' : '')}
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
              className="bbb-widget__input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Bertrand…"
              rows={2}
              disabled={isStreaming}
            />
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
