/** Sort facet value/count pairs by count desc, then label (optional collation). */
export function facetEntriesFromCountMap(
  m: Map<string, number>,
  localeCompareOptions?: Intl.CollatorOptions,
): { value: string; count: number }[] {
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.value.localeCompare(b.value, undefined, localeCompareOptions),
    )
}
