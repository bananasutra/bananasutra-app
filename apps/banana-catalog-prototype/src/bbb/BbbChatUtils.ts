export type Role = 'user' | 'assistant'

export type ChatMessage = {
  role: Role
  content: string
}

export type BbbSseEvent = {
  event: string
  payload: unknown
}

export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string; external: boolean }

export type InlineTextSegment = {
  text: string
  bold: boolean
  italic: boolean
}

const DEFAULT_ACTOR_STORAGE_KEY = 'bbb_actor_id'

function createActorId(prefix: string): string {
  try {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    const suffix = Array.from(bytes)
      .map((part) => part.toString(16).padStart(2, '0'))
      .join('')
    return `${prefix}-${suffix}`
  } catch {
    return `${prefix}-${Math.random().toString(36).slice(2, 12)}`
  }
}

export function getOrCreateActorId(storageKey = DEFAULT_ACTOR_STORAGE_KEY, prefix = 'bbb-web'): string {
  if (typeof window === 'undefined') return createActorId(prefix)
  try {
    const existing = window.localStorage.getItem(storageKey)?.trim()
    if (existing) return existing
    const created = createActorId(prefix)
    window.localStorage.setItem(storageKey, created)
    return created
  } catch {
    return createActorId(prefix)
  }
}

export function parseSseChunk(rawChunk: string): BbbSseEvent[] {
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

export function updateLastAssistant(messages: ChatMessage[], nextText: string): ChatMessage[] {
  if (!messages.length || messages[messages.length - 1]?.role !== 'assistant') {
    return [...messages, { role: 'assistant', content: nextText }]
  }
  const next = [...messages]
  const last = next[next.length - 1]
  next[next.length - 1] = { ...last, content: nextText }
  return next
}

export function capConversationHistory(messages: ChatMessage[], maxUserTurns = 5): ChatMessage[] {
  const nonEmpty = messages.filter((message) => message.content.trim().length > 0)
  if (maxUserTurns < 1) return nonEmpty

  let userTurnCount = 0
  let startIndex = 0
  for (let idx = nonEmpty.length - 1; idx >= 0; idx -= 1) {
    if (nonEmpty[idx]?.role === 'user') {
      userTurnCount += 1
      if (userTurnCount > maxUserTurns) {
        startIndex = idx + 1
        break
      }
    }
  }
  const capped = nonEmpty.slice(startIndex)
  const trimmedWindow = startIndex > 0
  while (
    trimmedWindow &&
    capped.length > 1 &&
    capped[0]?.role === 'assistant' &&
    capped.some((message) => message.role === 'user')
  ) {
    capped.shift()
  }
  return capped
}

function classifyHref(href: string): { safe: boolean; external: boolean } {
  const trimmed = href.trim()
  if (/^\/[^\s]*$/.test(trimmed)) return { safe: true, external: false }
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return { safe: true, external: true }
  return { safe: false, external: false }
}

function normalizeHref(href: string): string {
  let normalized = href.trim()
  while (normalized.startsWith('(') && normalized.endsWith(')') && normalized.length > 2) {
    normalized = normalized.slice(1, -1).trim()
  }
  return normalized
}

function pushTextWithAutoLinks(segments: MessageSegment[], text: string): void {
  const tokens = text.split(/(\s+)/)
  for (const token of tokens) {
    if (!token) continue
    if (/^\s+$/.test(token)) {
      segments.push({ type: 'text', text: token })
      continue
    }
    const leading = token.match(/^[("'[]+/)?.[0] ?? ''
    const trailing = token.match(/[.,!?;:)\]'"`]+$/)?.[0] ?? ''
    const coreStart = leading.length
    const coreEnd = token.length - trailing.length
    const core = token.slice(coreStart, Math.max(coreStart, coreEnd))
    const normalizedCore = normalizeHref(core)
    const hrefMeta = classifyHref(normalizedCore)
    if (normalizedCore.startsWith('/') && hrefMeta.safe) {
      if (leading) segments.push({ type: 'text', text: leading })
      segments.push({
        type: 'link',
        text: normalizedCore,
        href: normalizedCore,
        external: false,
      })
      if (trailing) segments.push({ type: 'text', text: trailing })
      continue
    }
    segments.push({ type: 'text', text: token })
  }
}

export function parseInlineEmphasis(text: string): InlineTextSegment[] {
  const segments: InlineTextSegment[] = []
  // Match bold first, then single-asterisk italics.
  // Italics require non-adjacent asterisks to avoid colliding with **bold**.
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|(?<!\*)\*([^*\n]+)\*(?!\*))/g
  let cursor = 0
  let match = pattern.exec(text)

  while (match) {
    const raw = match[0]
    const boldText = match[2] ?? match[3] ?? ''
    const italicText = match[4] ?? ''
    const isBold = Boolean(boldText)
    const matchStart = match.index
    const matchEnd = matchStart + raw.length
    if (matchStart > cursor) {
      segments.push({ text: text.slice(cursor, matchStart), bold: false, italic: false })
    }
    segments.push({
      text: isBold ? boldText : italicText,
      bold: isBold,
      italic: !isBold,
    })
    cursor = matchEnd
    match = pattern.exec(text)
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), bold: false, italic: false })
  }
  return segments.length ? segments : [{ text, bold: false, italic: false }]
}

export function parseMarkdownLinks(text: string): MessageSegment[] {
  const sourceText = text.replace(/\]\(\((\/[^)\s]+)\)\)/g, ']($1)')
  const segments: MessageSegment[] = []
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g
  let cursor = 0
  let match = pattern.exec(sourceText)

  while (match) {
    const [raw, label, href] = match
    const matchStart = match.index
    const matchEnd = matchStart + raw.length

    if (matchStart > cursor) {
      pushTextWithAutoLinks(segments, sourceText.slice(cursor, matchStart))
    }

    const normalizedHref = normalizeHref(href)
    const hrefMeta = classifyHref(normalizedHref)
    if (hrefMeta.safe) {
      segments.push({ type: 'link', text: label, href: normalizedHref, external: hrefMeta.external })
    } else {
      pushTextWithAutoLinks(segments, raw)
    }

    cursor = matchEnd
    match = pattern.exec(sourceText)
  }

  if (cursor < sourceText.length) {
    pushTextWithAutoLinks(segments, sourceText.slice(cursor))
  }

  return segments.length ? segments : [{ type: 'text', text }]
}
