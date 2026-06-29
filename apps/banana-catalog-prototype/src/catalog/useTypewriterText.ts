import { useEffect, useRef, useState } from 'react'

const DEFAULT_MS_PER_CHAR = 40

type Options = {
  msPerChar?: number
}

/** Character-by-character pull-quote typing; instant when prefers-reduced-motion. */
export function useTypewriterText(fullText: string, options: Options = {}): string {
  const msPerChar = options.msPerChar ?? DEFAULT_MS_PER_CHAR
  const [typedText, setTypedText] = useState('')
  const intervalRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const full = (fullText || '').trim()
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }
    if (!full) {
      queueMicrotask(() => setTypedText(''))
      return
    }
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      queueMicrotask(() => setTypedText(full))
      return
    }
    queueMicrotask(() => setTypedText(''))
    let idx = 0
    intervalRef.current = window.setInterval(() => {
      idx += 1
      setTypedText(full.slice(0, idx))
      if (idx >= full.length && intervalRef.current !== undefined) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }, msPerChar)
    return () => {
      if (intervalRef.current !== undefined) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [fullText, msPerChar])

  return typedText
}
