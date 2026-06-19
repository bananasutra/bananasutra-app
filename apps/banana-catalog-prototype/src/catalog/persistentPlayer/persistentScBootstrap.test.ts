import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPersistentScBootstrapSnapshot,
  primePersistentScIframe,
  persistentScIframeIsWarm,
  requestPersistentScLoad,
  requestPersistentScLoadSync,
  resetAndPrimePersistentSc,
  resetPersistentScBootstrap,
  subscribePersistentScBootstrap,
} from './persistentScBootstrap'

const SC_URL = 'https://soundcloud.com/bananasutra/example-track'

test('requestPersistentScLoad cold start with remount sets url and bumps generation', () => {
  resetPersistentScBootstrap()
  requestPersistentScLoad(SC_URL, { autoPlay: true, remount: true })
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.url, SC_URL)
  assert.equal(snap.autoPlay, true)
  assert.equal(snap.generation, 1)
})

test('requestPersistentScLoad warm remount bumps generation for iframe remount key', () => {
  resetPersistentScBootstrap()
  requestPersistentScLoad(SC_URL, { autoPlay: true, remount: true })
  requestPersistentScLoad(SC_URL, { autoPlay: true, remount: true })
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.generation, 2)
})

test('subscribePersistentScBootstrap notifies on load request', () => {
  resetPersistentScBootstrap()
  let calls = 0
  const unsub = subscribePersistentScBootstrap(() => {
    calls += 1
  })
  requestPersistentScLoad(SC_URL, { autoPlay: false })
  unsub()
  assert.equal(calls, 1)
  assert.equal(getPersistentScBootstrapSnapshot().url, SC_URL)
})

test('requestPersistentScLoadSync matches async bootstrap snapshot', () => {
  resetPersistentScBootstrap()
  requestPersistentScLoadSync(SC_URL, { autoPlay: true, remount: true })
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.url, SC_URL)
  assert.equal(snap.autoPlay, true)
  assert.equal(snap.generation, 1)
})

test('primePersistentScIframe mounts warm iframe without generation bump', () => {
  resetPersistentScBootstrap()
  primePersistentScIframe()
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.url, 'https://soundcloud.com/bananasutra/08-tell-the-truth-knowsutra-true-blues-cover-8')
  assert.equal(snap.autoPlay, false)
  assert.equal(snap.generation, 0)
  assert.equal(persistentScIframeIsWarm(), true)
})

test('resetAndPrimePersistentSc clears then re-warms iframe', () => {
  requestPersistentScLoad(SC_URL, { autoPlay: true, remount: true })
  resetAndPrimePersistentSc()
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.url, 'https://soundcloud.com/bananasutra/08-tell-the-truth-knowsutra-true-blues-cover-8')
  assert.equal(snap.generation, 0)
})

test('resetPersistentScBootstrap clears bootstrap for dismiss/stop', () => {
  requestPersistentScLoad(SC_URL, { autoPlay: true, remount: true })
  resetPersistentScBootstrap()
  const snap = getPersistentScBootstrapSnapshot()
  assert.equal(snap.url, null)
  assert.equal(snap.autoPlay, false)
  assert.equal(snap.generation, 0)
})
