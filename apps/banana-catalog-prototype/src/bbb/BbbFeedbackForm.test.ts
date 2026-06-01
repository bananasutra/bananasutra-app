import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFeedbackPayload, canReviewFeedbackForm, feedbackIntentLabel, isValidFeedbackEmail } from './BbbFeedbackForm'

test('feedbackIntentLabel maps intent slugs to user-facing labels', () => {
  assert.equal(feedbackIntentLabel('feedback'), 'feedback')
  assert.equal(feedbackIntentLabel('song-idea'), 'song idea')
  assert.equal(feedbackIntentLabel('bug-report'), 'bug report')
  assert.equal(feedbackIntentLabel('broken-link'), 'broken link')
})

test('canReviewFeedbackForm requires message, name, and valid email', () => {
  assert.equal(canReviewFeedbackForm({ message: 'hello', name: 'Banana', email: 'banana@example.com' }), true)
  assert.equal(canReviewFeedbackForm({ message: '', name: 'Banana', email: 'banana@example.com' }), false)
  assert.equal(canReviewFeedbackForm({ message: 'hello', name: '', email: 'banana@example.com' }), false)
  assert.equal(canReviewFeedbackForm({ message: 'hello', name: 'Banana', email: 'not-an-email' }), false)
  assert.equal(isValidFeedbackEmail('banana@example.com'), true)
  assert.equal(isValidFeedbackEmail('bad'), false)
})

test('buildFeedbackPayload trims values and includes conversation tail only when opted in', () => {
  const withTail = buildFeedbackPayload({
    intentType: 'feedback',
    message: '  hello there  ',
    name: '  Banana  ',
    email: '  banana@example.com  ',
    includeConversationTail: true,
    conversationTail: 'User: hi\nBBB: hello',
    pageContext: { pathname: '/songs', search: '?q=hope' },
  })
  assert.deepEqual(withTail, {
    intentType: 'feedback',
    message: 'hello there',
    name: 'Banana',
    email: 'banana@example.com',
    conversationTail: 'User: hi\nBBB: hello',
    pageContext: { pathname: '/songs', search: '?q=hope' },
  })

  const withoutTail = buildFeedbackPayload({
    intentType: 'song-idea',
    message: 'idea',
    name: 'Banana',
    email: 'banana@example.com',
    includeConversationTail: false,
    conversationTail: 'ignored',
  })
  assert.deepEqual(withoutTail, {
    intentType: 'song-idea',
    message: 'idea',
    name: 'Banana',
    email: 'banana@example.com',
  })

  const withCopy = buildFeedbackPayload({
    intentType: 'feedback',
    message: 'hello',
    name: 'Banana',
    email: 'banana@example.com',
    includeConversationTail: false,
    sendCopy: true,
  })
  assert.deepEqual(withCopy, {
    intentType: 'feedback',
    message: 'hello',
    name: 'Banana',
    email: 'banana@example.com',
    sendCopy: true,
  })
})
