import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import type { ReactNode } from 'react'
import { NotFoundRoute } from './NotFoundRoute'

const happyWindow = new Window()
Object.defineProperty(globalThis, 'window', { value: happyWindow, configurable: true })
Object.defineProperty(globalThis, 'document', { value: happyWindow.document, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: happyWindow.navigator, configurable: true })
Object.defineProperty(globalThis, 'location', { value: happyWindow.location, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: happyWindow.localStorage, configurable: true })
Object.defineProperty(globalThis, 'CustomEvent', { value: happyWindow.CustomEvent, configurable: true })

const flush = async () =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0)
  })

const mount = async (node: ReactNode): Promise<{ container: HTMLDivElement; root: Root }> => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(node)
    await flush()
  })
  return { container, root }
}

const unmount = async (root: Root, container: HTMLDivElement) => {
  await act(async () => {
    root.unmount()
    await flush()
  })
  container.remove()
}

test('NotFoundRoute logs bad path and dispatches bbb:open on button click', async () => {
  const logged: Array<{ badPath: string; referrer?: string }> = []
  let openDetail: unknown = null

  const onOpen = (event: Event) => {
    openDetail = (event as CustomEvent).detail
  }
  window.addEventListener('bbb:open', onOpen)

  const { container, root } = await mount(
    <MemoryRouter initialEntries={['/banana-republic']}>
      <NotFoundRoute
        onLogNotFound={(input) => {
          logged.push(input)
        }}
      />
    </MemoryRouter>,
  )

  assert.equal(logged.length, 1)
  assert.equal(logged[0]?.badPath, '/banana-republic')

  const ringButton = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Ring Bertrand'),
  )
  assert.ok(ringButton)

  await act(async () => {
    ringButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await flush()
  })

  assert.deepEqual(openDetail, { reason: '404', badPath: '/banana-republic' })
  window.removeEventListener('bbb:open', onOpen)
  await unmount(root, container)
})
