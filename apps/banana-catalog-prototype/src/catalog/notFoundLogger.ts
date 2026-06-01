const DEFAULT_BBB_ENDPOINT = 'http://localhost:8787/api/bbb'
const BBB_ENDPOINT =
  ((import.meta as ImportMeta & { env?: { VITE_BBB_API_ENDPOINT?: string } }).env?.VITE_BBB_API_ENDPOINT?.trim() ??
    '') || DEFAULT_BBB_ENDPOINT

const get404LogEndpoint = (): string => {
  try {
    return new URL('/api/bbb/404-log', BBB_ENDPOINT).toString()
  } catch {
    return '/api/bbb/404-log'
  }
}

export async function logNotFound({
  badPath,
  referrer,
}: {
  badPath: string
  referrer?: string
}): Promise<void> {
  const normalizedBadPath = badPath.trim()
  if (!normalizedBadPath.startsWith('/')) return
  try {
    await fetch(get404LogEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bad_path: normalizedBadPath,
        referrer: referrer?.trim() || undefined,
      }),
    })
  } catch {
    // Never block 404 rendering on telemetry failures.
  }
}
