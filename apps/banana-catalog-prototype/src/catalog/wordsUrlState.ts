import type { FilterState, SortMode } from './types'
import type { WordsStoryBucket } from './wordsStory'
import { parseWordsStoryBucket } from './wordsStory'
import { searchParamsFromSearchString } from './urlSearchParams'
import { parseSort, readBrowseStateFromSearchParams, readFindFromSearchParams, serializeBrowseQuery } from './urlState'

const PARAM_WB = 'wb'

export const WORDS_BROWSE_PATH = '/words'

/** `/words` only exposes date + title sorts; play/like modes are meaningless for lyrics-only rows. */
const WORDS_SORT_MODES = new Set<SortMode>(['newest', 'title_az'])

export function normalizeSortForWords(sort: SortMode): SortMode {
  return WORDS_SORT_MODES.has(sort) ? sort : 'newest'
}

/** Read sort, facets, find, and words bucket from `/words?…` (ignores `media`). */
export function readWordsStateFromUrl(): {
  sort: SortMode
  filters: FilterState
  find: string
  bucket: WordsStoryBucket
} {
  const params = searchParamsFromSearchString(window.location.search)
  const sort: SortMode = params.has('sort')
    ? normalizeSortForWords(parseSort(params.get('sort')))
    : 'newest'
  const { filters } = readBrowseStateFromSearchParams(params)
  const find = readFindFromSearchParams(params)
  const bucket = parseWordsStoryBucket(params.get(PARAM_WB))
  return { sort, filters, find, bucket }
}

export function buildWordsPath(
  sort: SortMode,
  filters: FilterState,
  find?: string,
  bucket: WordsStoryBucket = 'all',
  page: number = 1,
): string {
  const qs = serializeBrowseQuery(sort, filters, find, 'all', page)
  const params = searchParamsFromSearchString(qs)
  if (bucket !== 'all') params.set(PARAM_WB, bucket)
  const s = params.toString()
  return s ? `${WORDS_BROWSE_PATH}?${s}` : WORDS_BROWSE_PATH
}
