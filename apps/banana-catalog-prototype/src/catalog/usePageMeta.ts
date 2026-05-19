import { createElement } from 'react'
import type { PageMetaProps } from './PageMeta'
import { PageMeta } from './PageMeta'
import { DEFAULT_OG_IMAGE_URL, songOgImageUrl } from './pageMetaConstants'

export type { PageMetaProps }
export { DEFAULT_OG_IMAGE_URL, PageMeta, songOgImageUrl }

/** Renders `<PageMeta />` for use in JSX (`{renderPageMeta({...})}` or `const m = renderPageMeta(...); return <>{m}…`). */
export function renderPageMeta(props: PageMetaProps) {
  return createElement(PageMeta, props)
}

/** @deprecated Use `renderPageMeta` + JSX, or `<PageMeta />` directly. */
export function usePageMeta(props: PageMetaProps) {
  return renderPageMeta(props)
}
