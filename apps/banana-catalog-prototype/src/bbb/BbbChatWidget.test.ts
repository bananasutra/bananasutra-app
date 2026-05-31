import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  capConversationHistory,
  getOrCreateActorId,
  parseInlineEmphasis,
  parseMarkdownLinks,
  parseSseChunk,
  updateLastAssistant,
} from './BbbChatUtils'

function renderInlineTextNodes(text: string, keyPrefix: string): React.ReactNode[] {
  return parseInlineEmphasis(text).map((piece, idx) =>
    piece.bold
      ? React.createElement('strong', { key: `${keyPrefix}-b-${idx}` }, piece.text)
      : piece.italic
        ? React.createElement('em', { key: `${keyPrefix}-i-${idx}` }, piece.text)
        : React.createElement('span', { key: `${keyPrefix}-t-${idx}` }, piece.text),
  )
}

function renderAssistantMessageHtml(content: string): string {
  const children = parseMarkdownLinks(content).map((segment, segmentIdx) =>
    segment.type === 'link'
      ? React.createElement(
          'a',
          { key: `seg-${segmentIdx}`, href: segment.href },
          ...renderInlineTextNodes(segment.text, `link-${segmentIdx}`),
        )
      : React.createElement(
          'span',
          { key: `seg-${segmentIdx}` },
          ...renderInlineTextNodes(segment.text, `text-${segmentIdx}`),
        ),
  )

  return renderToStaticMarkup(React.createElement('p', null, ...children))
}

test('parseSseChunk parses token and done events in order', () => {
  const raw = [
    'event: token',
    'data: {"text":"Hel"}',
    '',
    'event: token',
    'data: {"text":"lo"}',
    '',
    'event: done',
    'data: {"ok":true}',
    '',
  ].join('\n')

  const events = parseSseChunk(raw)

  assert.equal(events.length, 3)
  assert.equal(events[0]?.event, 'token')
  assert.deepEqual(events[0]?.payload, { text: 'Hel' })
  assert.equal(events[1]?.event, 'token')
  assert.deepEqual(events[1]?.payload, { text: 'lo' })
  assert.equal(events[2]?.event, 'done')
  assert.deepEqual(events[2]?.payload, { ok: true })
})

test('parseSseChunk skips malformed JSON blocks and continues', () => {
  const raw = ['event: token', 'data: {"text":"ok"}', '', 'event: token', 'data: {"text":', ''].join('\n')
  const events = parseSseChunk(raw)
  assert.equal(events.length, 1)
  assert.deepEqual(events[0], { event: 'token', payload: { text: 'ok' } })
})

test('updateLastAssistant replaces the latest assistant message', () => {
  const messages = [
    { role: 'assistant' as const, content: 'Welcome' },
    { role: 'user' as const, content: 'Hey' },
    { role: 'assistant' as const, content: 'Old reply' },
  ]

  const updated = updateLastAssistant(messages, 'New reply')

  assert.equal(updated.length, 3)
  assert.deepEqual(updated[2], { role: 'assistant', content: 'New reply' })
})

test('updateLastAssistant appends when last role is not assistant', () => {
  const messages = [
    { role: 'assistant' as const, content: 'Welcome' },
    { role: 'user' as const, content: 'Question' },
  ]
  const updated = updateLastAssistant(messages, 'Answer')
  assert.equal(updated.length, 3)
  assert.deepEqual(updated[2], { role: 'assistant', content: 'Answer' })
})

test('capConversationHistory keeps only last five user turns', () => {
  const messages = [
    { role: 'assistant' as const, content: 'Welcome' },
    { role: 'user' as const, content: 'u1' },
    { role: 'assistant' as const, content: 'a1' },
    { role: 'user' as const, content: 'u2' },
    { role: 'assistant' as const, content: 'a2' },
    { role: 'user' as const, content: 'u3' },
    { role: 'assistant' as const, content: 'a3' },
    { role: 'user' as const, content: 'u4' },
    { role: 'assistant' as const, content: 'a4' },
    { role: 'user' as const, content: 'u5' },
    { role: 'assistant' as const, content: 'a5' },
    { role: 'user' as const, content: 'u6' },
    { role: 'assistant' as const, content: 'a6' },
  ]
  const capped = capConversationHistory(messages, 5)
  assert.equal(capped.some((m) => m.content === 'u1'), false)
  assert.equal(capped.some((m) => m.content === 'a1'), false)
  assert.equal(capped[0]?.content, 'u2')
  assert.equal(capped[capped.length - 1]?.content, 'a6')
})

test('capConversationHistory preserves initial assistant intro on first user turn', () => {
  const messages = [
    { role: 'assistant' as const, content: 'Welcome. I am Bertrand.' },
    { role: 'user' as const, content: "what's fun around here?" },
  ]
  const capped = capConversationHistory(messages, 5)
  assert.equal(capped.length, 2)
  assert.equal(capped[0]?.role, 'assistant')
  assert.equal(capped[1]?.role, 'user')
})

test('parseMarkdownLinks converts safe internal and external links', () => {
  const segments = parseMarkdownLinks('Visit [Songs](/songs) and [Docs](https://example.com).')
  const links = segments.filter((segment) => segment.type === 'link')
  assert.equal(links.length, 2)
  assert.deepEqual(links[0], {
    type: 'link',
    text: 'Songs',
    href: '/songs',
    external: false,
  })
  assert.deepEqual(links[1], {
    type: 'link',
    text: 'Docs',
    href: 'https://example.com',
    external: true,
  })
})

test('parseMarkdownLinks leaves unsafe links as text', () => {
  const segments = parseMarkdownLinks('Bad [link](javascript:alert(1)) should stay text.')
  assert.equal(segments.some((segment) => segment.type === 'link'), false)
})

test('parseMarkdownLinks normalizes malformed double-parenthesis route links', () => {
  const segments = parseMarkdownLinks('Try [Jazz Tracks]((/tracks/?primary_genre=JAZZ&tsort=likes)).')
  const link = segments.find((segment) => segment.type === 'link')
  assert.deepEqual(link, {
    type: 'link',
    text: 'Jazz Tracks',
    href: '/tracks/?primary_genre=JAZZ&tsort=likes',
    external: false,
  })
})

test('parseMarkdownLinks auto-links bare internal routes in plain text', () => {
  const segments = parseMarkdownLinks('Use /tracks/?primary_genre=JAZZ&tsort=likes or /songs/url-slug.')
  const links = segments.filter((segment) => segment.type === 'link')
  assert.equal(links.length, 2)
  assert.deepEqual(links[0], {
    type: 'link',
    text: '/tracks/?primary_genre=JAZZ&tsort=likes',
    href: '/tracks/?primary_genre=JAZZ&tsort=likes',
    external: false,
  })
  assert.deepEqual(links[1], {
    type: 'link',
    text: '/songs/url-slug',
    href: '/songs/url-slug',
    external: false,
  })
})

test('parseMarkdownLinks preserves bold markdown text with spaces', () => {
  const raw = '**If you want kindness as a practice:** Dare: KIND(ness) is direct.'
  const segments = parseMarkdownLinks(raw)
  assert.deepEqual(segments, [{ type: 'text', text: raw }])
  const emphasis = parseInlineEmphasis((segments[0] as { type: 'text'; text: string }).text)
  assert.equal(emphasis[0]?.bold, true)
  assert.equal(emphasis[0]?.text, 'If you want kindness as a practice:')
})

test('parseMarkdownLinks keeps emphasis parse-friendly around bare routes', () => {
  const segments = parseMarkdownLinks('Try **Truth that stings** near /tracks/?q=truth.')
  const textParts = segments.filter((segment) => segment.type === 'text')
  const links = segments.filter((segment) => segment.type === 'link')
  assert.equal(links.length, 1)
  assert.deepEqual(links[0], {
    type: 'link',
    text: '/tracks/?q=truth',
    href: '/tracks/?q=truth',
    external: false,
  })
  assert.equal(textParts.length, 2)
  assert.equal((textParts[0] as { type: 'text'; text: string }).text, 'Try **Truth that stings** near ')
  assert.equal((textParts[1] as { type: 'text'; text: string }).text, '.')
  const emphasis = parseInlineEmphasis((textParts[0] as { type: 'text'; text: string }).text)
  assert.equal(emphasis.some((segment) => segment.bold && segment.text === 'Truth that stings'), true)
})

test('parseInlineEmphasis identifies markdown bold segments', () => {
  const segments = parseInlineEmphasis('- **Truth that stings** when lying feels easier')
  assert.equal(segments.length, 3)
  assert.deepEqual(segments[0], { text: '- ', bold: false, italic: false })
  assert.deepEqual(segments[1], { text: 'Truth that stings', bold: true, italic: false })
  assert.deepEqual(segments[2], { text: ' when lying feels easier', bold: false, italic: false })
})

test('parseInlineEmphasis identifies markdown italics segments', () => {
  const segments = parseInlineEmphasis('give me something *dirty* and explicit')
  assert.equal(segments.length, 3)
  assert.deepEqual(segments[0], { text: 'give me something ', bold: false, italic: false })
  assert.deepEqual(segments[1], { text: 'dirty', bold: false, italic: true })
  assert.deepEqual(segments[2], { text: ' and explicit', bold: false, italic: false })
})

test('parseInlineEmphasis keeps bold, italics, and links parse-friendly in same line', () => {
  const segments = parseInlineEmphasis('Try **truth** with *texture* near /tracks/?q=jazz')
  assert.deepEqual(segments, [
    { text: 'Try ', bold: false, italic: false },
    { text: 'truth', bold: true, italic: false },
    { text: ' with ', bold: false, italic: false },
    { text: 'texture', bold: false, italic: true },
    { text: ' near /tracks/?q=jazz', bold: false, italic: false },
  ])
})

test('parseInlineEmphasis leaves unmatched or triple-asterisk edge cases as plain text', () => {
  const unmatched = parseInlineEmphasis('keep *this literal and keep going')
  assert.deepEqual(unmatched, [{ text: 'keep *this literal and keep going', bold: false, italic: false }])

  const triple = parseInlineEmphasis('***nope***')
  assert.deepEqual(triple, [
    { text: '*', bold: false, italic: false },
    { text: 'nope', bold: true, italic: false },
    { text: '*', bold: false, italic: false },
  ])
})

test('assistant render output includes strong tags for markdown bold with spaces', () => {
  const html = renderAssistantMessageHtml('**If you want kindness as a practice:** Dare: KIND(ness) is direct.')
  assert.match(html, /<strong>If you want kindness as a practice:<\/strong>/)
  assert.match(html, /Dare: KIND\(ness\) is direct\./)
})

test('getOrCreateActorId persists actor id in localStorage', () => {
  const storage = new Map<string, string>()
  const originalWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    },
  }

  try {
    const first = getOrCreateActorId('bbb_actor_id_test', 'bbb-test')
    const second = getOrCreateActorId('bbb_actor_id_test', 'bbb-test')
    assert.match(first, /^bbb-test-/)
    assert.equal(second, first)
  } finally {
    if (typeof originalWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window
    } else {
      ;(globalThis as { window: unknown }).window = originalWindow
    }
  }
})
